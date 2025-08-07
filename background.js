let currentTask = null;
let isTaskRunning = false;
let currentTabId = null;
let actionQueue = [];
let currentActionIndex = 0;
let continuousMode = false;
let taskGoal = null;
let apiKeyGlobal = null;
let completedActions = [];
let maxIterations = 20; // Prevent infinite loops
let currentIteration = 0;
let liveStream = null; // Gemini Live API WebSocket connection
let webSocketWorkflow = null; // New WebSocket workflow instance
let multiTabManager = null; // Multi-tab automation manager

// Initialize multi-tab manager on extension load
chrome.runtime.onInstalled.addListener(() => {
    console.log('AI Web Automation Extension installed/updated');
    // Initialize multi-tab manager will be done when needed
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Open the side panel
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('Side panel opened successfully');
    } catch (error) {
        console.error('Failed to open side panel:', error);
        // Fallback: try to open in the current window
        try {
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
});

// Import live streaming module (removed for now - causing issues with manifest v3)
// Will be loaded dynamically when needed

// Listen for messages from popup and sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startTask') {
        startAutomation(request.task, request.tabId, request.apiKey);
        sendResponse({ success: true });
    } else if (request.action === 'startContinuousWorkflow') {
        startContinuousWorkflow(request.task, request.tabId, request.apiKey);
        sendResponse({ success: true });
    } else if (request.action === 'startWebSocketWorkflow') {
        startWebSocketWorkflow(request.task, request.tabId, request.apiKey);
        sendResponse({ success: true });
    } else if (request.action === 'startMultiTabWorkflow') {
        startMultiTabWorkflow(request.task, request.apiKey);
        sendResponse({ success: true });
    } else if (request.action === 'startLiveMode') {
        startLiveMode(request.tabId, request.apiKey);
        sendResponse({ success: true });
    } else if (request.action === 'stopLiveMode') {
        stopLiveMode();
        sendResponse({ success: true });
    } else if (request.action === 'sendLiveMessage') {
        sendLiveMessage(request.message);
        sendResponse({ success: true });
    } else if (request.action === 'stopTask' || request.action === 'stopWorkflow') {
        stopAutomation();
        sendResponse({ success: true });
    } else if (request.action === 'actionCompleted') {
        processNextAction();
        sendResponse({ success: true });
    } else if (request.action === 'screenshotCaptured') {
        handleScreenshot(request.screenshot);
        sendResponse({ success: true });
    }
    return true;
});

async function startContinuousWorkflow(task, tabId, apiKey) {
    if (isTaskRunning) {
        sendWorkflowUpdate({ log: 'Workflow already running', logType: 'error' });
        return;
    }

    // Initialize continuous workflow
    continuousMode = true;
    currentTask = task;
    taskGoal = task;
    currentTabId = tabId;
    apiKeyGlobal = apiKey;
    isTaskRunning = true;
    completedActions = [];
    currentIteration = 0;
    actionQueue = [];
    currentActionIndex = 0;

    sendWorkflowUpdate({
        log: `Starting continuous workflow: ${task}`,
        logType: 'info',
        status: 'Analyzing task...',
        progress: 10
    });

    // Start the continuous analysis loop
    analyzeContinuously(tabId);
}

async function analyzeContinuously(tabId) {
    if (!isTaskRunning || !continuousMode) return;
    
    currentIteration++;
    if (currentIteration > maxIterations) {
        sendWorkflowUpdate({
            log: 'Maximum iterations reached. Stopping to prevent infinite loop.',
            logType: 'error'
        });
        completeWorkflow(false, 'Maximum iterations reached');
        return;
    }

    // Get current tab state
    chrome.tabs.get(tabId, async (tab) => {
        if (chrome.runtime.lastError) {
            sendWorkflowUpdate({ log: 'Lost connection to tab', logType: 'error' });
            stopAutomation();
            return;
        }

        sendWorkflowUpdate({
            log: `Analyzing page: ${tab.url}`,
            logType: 'info',
            status: 'Capturing page state...'
        });

        // Inject and capture screenshot
        injectAndCapture(tabId, async (screenshot) => {
            if (!screenshot) {
                sendWorkflowUpdate({ log: 'Failed to capture page', logType: 'error' });
                stopAutomation();
                return;
            }

            try {
                // Leverage Gemini 2.5 Flash's thinking capabilities for better reasoning
                const prompt = `
                    You are using Gemini 2.5 Flash with advanced thinking capabilities.
                    Think step-by-step about the current situation and what needs to be done next.
                    
                    ULTIMATE GOAL: ${taskGoal}
                    
                    CURRENT STATE:
                    - URL: ${tab.url}
                    - Page Title: ${tab.title}
                    - Iteration: ${currentIteration} of ${maxIterations}
                    
                    PROGRESS SO FAR:
                    ${completedActions.length > 0 ? completedActions.map(a => `✓ ${a}`).join('\n') : '• Starting fresh - no actions taken yet'}
                    
                    REASONING TASK:
                    1. First, think about whether the goal has been achieved
                    2. If not, reason about what specific information or action is still needed
                    3. Consider the current page context and what's visible
                    4. Plan the most efficient next steps
                    
                    DECISION:
                    - If the goal is FULLY achieved, return:
                      [{"type": "complete", "message": "Goal achieved: [specific description of what was accomplished]"}]
                    
                    - If you need to continue, return the next logical actions.
                    - Be specific and thorough, but avoid unnecessary repetition.
                    - Maximum 5 actions per batch for better control.
                    
                    Use your enhanced reasoning to make smart decisions about navigation, interaction, and goal completion.
                `;

                const actions = await analyzeWithGemini(prompt, screenshot, apiKeyGlobal, tab.url);
                
                if (actions && actions.length > 0) {
                    // Check if task is complete
                    if (actions[0].type === 'complete') {
                        completeWorkflow(true, actions[0].message);
                        return;
                    }

                    // Execute the actions
                    actionQueue = actions;
                    currentActionIndex = 0;
                    
                    sendWorkflowUpdate({
                        steps: actions,
                        currentStep: 0,
                        log: `Generated ${actions.length} actions for this iteration`,
                        logType: 'info'
                    });

                    executeActionsWithContinuation();
                } else {
                    sendWorkflowUpdate({ log: 'No actions generated', logType: 'error' });
                    setTimeout(() => analyzeContinuously(tabId), 2000);
                }
            } catch (error) {
                sendWorkflowUpdate({ 
                    log: `AI analysis error: ${error.message}`, 
                    logType: 'error' 
                });
                stopAutomation();
            }
        });
    });
}

function executeActionsWithContinuation() {
    if (!isTaskRunning || currentActionIndex >= actionQueue.length) {
        // All actions in this batch completed, analyze again
        if (continuousMode) {
            sendWorkflowUpdate({
                log: 'Batch completed, analyzing next steps...',
                logType: 'info'
            });
            setTimeout(() => analyzeContinuously(currentTabId), 2000);
        }
        return;
    }

    const action = actionQueue[currentActionIndex];
    const progress = Math.round(((currentActionIndex + 1) / actionQueue.length) * 100);
    
    sendWorkflowUpdate({
        currentStep: currentActionIndex,
        status: `Executing: ${action.description}`,
        progress: progress
    });

    // Handle navigation specially in continuous mode
    if (action.type === 'navigate') {
        // Set up listener for navigation complete
        const navigationListener = (details) => {
            if (details.tabId === currentTabId && details.frameId === 0) {
                chrome.webNavigation.onCompleted.removeListener(navigationListener);
                
                completedActions.push(action.description);
                sendWorkflowUpdate({
                    log: `✓ Navigated to: ${action.url}`,
                    logType: 'success'
                });
                
                // After navigation, restart analysis
                setTimeout(() => analyzeContinuously(currentTabId), 2000);
            }
        };
        
        chrome.webNavigation.onCompleted.addListener(navigationListener);
        
        // Perform navigation
        chrome.tabs.update(currentTabId, { url: action.url });
        return;
    }

    // Execute non-navigation actions
    chrome.tabs.sendMessage(currentTabId, {
        action: 'executeAction',
        actionData: action,
        showOverlay: true
    }, (response) => {
        if (chrome.runtime.lastError) {
            // Page might have changed, re-inject scripts
            injectScripts(currentTabId, () => {
                // Retry the action
                chrome.tabs.sendMessage(currentTabId, {
                    action: 'executeAction',
                    actionData: action,
                    showOverlay: true
                }, handleActionResponse);
            });
            return;
        }
        
        handleActionResponse(response);
    });

    function handleActionResponse(response) {
        if (response && response.success) {
            completedActions.push(action.description);
            currentActionIndex++;
            
            sendWorkflowUpdate({
                log: `✓ ${action.description}`,
                logType: 'success'
            });
            
            // Continue with next action
            setTimeout(() => {
                executeActionsWithContinuation();
            }, action.type === 'wait' ? action.duration : 1000);
        } else {
            sendWorkflowUpdate({
                log: `Failed: ${action.description} - ${response?.error}`,
                logType: 'error'
            });
            
            // Try to continue anyway
            currentActionIndex++;
            setTimeout(() => executeActionsWithContinuation(), 1000);
        }
    }
}

function injectAndCapture(tabId, callback) {
    injectScripts(tabId, () => {
        chrome.tabs.sendMessage(tabId, { 
            action: 'captureScreenshot' 
        }, (response) => {
            if (chrome.runtime.lastError || !response) {
                callback(null);
            } else {
                callback(response.screenshot);
            }
        });
    });
}

function injectScripts(tabId, callback) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js', 'overlay.js']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('Script injection error:', chrome.runtime.lastError);
            callback(false);
            return;
        }
        
        chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['overlay.css']
        }, () => {
            setTimeout(callback, 500);
        });
    });
}

function sendWorkflowUpdate(data) {
    chrome.runtime.sendMessage({
        action: 'workflowUpdate',
        ...data
    }).catch(() => {
        // Sidepanel might not be open
    });
}

function completeWorkflow(success, message) {
    continuousMode = false;
    isTaskRunning = false;
    
    chrome.runtime.sendMessage({
        action: 'workflowCompleted',
        success: success,
        message: message
    }).catch(() => {});
    
    stopAutomation();
}

async function startAutomation(task, tabId, apiKey) {
    if (isTaskRunning) {
        sendStatusUpdate('Task already running', 'error');
        return;
    }

    // First, check if we can access this tab
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            sendStatusUpdate('Error: Cannot access this tab', 'error');
            return;
        }

        // Check for restricted URLs
        const restrictedUrls = [
            'chrome://',
            'chrome-extension://',
            'edge://',
            'about:',
            'file:///',
            'view-source:',
            'data:',
            'devtools://',
            'chrome-devtools://'
        ];

        const isRestricted = restrictedUrls.some(url => tab.url.startsWith(url));
        
        if (isRestricted) {
            sendStatusUpdate('Error: Cannot automate Chrome system pages. Please navigate to a regular website.', 'error');
            return;
        }

        // Check for special pages
        if (!tab.url || tab.url === 'about:blank' || tab.url === '') {
            sendStatusUpdate('Error: Please navigate to a website first', 'error');
            return;
        }

        // Proceed with automation
        proceedWithAutomation(task, tabId, apiKey);
    });
}

async function proceedWithAutomation(task, tabId, apiKey) {
    currentTask = task;
    currentTabId = tabId;
    isTaskRunning = true;
    actionQueue = [];
    currentActionIndex = 0;

    sendStatusUpdate('Capturing screenshot...', 'info', 'Taking screenshot', 20);

    // First, inject the content scripts to ensure they're loaded
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js', 'overlay.js']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('Script injection error:', chrome.runtime.lastError);
            sendStatusUpdate('Error: Cannot access this page. Some pages restrict extensions.', 'error');
            stopAutomation();
            return;
        }
        // Inject CSS as well
        chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['overlay.css']
        }, () => {
            // Wait a moment for scripts to initialize
            setTimeout(() => {
                // Request screenshot from content script
                chrome.tabs.sendMessage(tabId, { 
                    action: 'captureScreenshot' 
                }, async (response) => {
                    if (chrome.runtime.lastError) {
                        sendStatusUpdate('Error: Could not connect to page. Please refresh and try again.', 'error');
                        stopAutomation();
                        return;
                    }

                    if (response && response.screenshot) {
                        sendStatusUpdate('Analyzing page with AI...', 'info', 'Processing with Gemini', 40);
                        
                        try {
                            // Get current tab URL
                            chrome.tabs.get(tabId, async (tab) => {
                                const actions = await analyzeWithGemini(task, response.screenshot, apiKey, tab.url);
                                if (actions && actions.length > 0) {
                                actionQueue = actions;
                                sendStatusUpdate(`Generated ${actions.length} actions`, 'info', 'Starting execution', 60);
                                executeActions();
                                } else {
                                    sendStatusUpdate('No actions generated', 'error');
                                    stopAutomation();
                                }
                            });
                        } catch (error) {
                            sendStatusUpdate('AI analysis failed: ' + error.message, 'error');
                            stopAutomation();
                        }
                    }
                });
            }, 500);
        });
    });
}

// Helper function to extract search term from task
function extractSearchTerm(task) {
    const searchPatterns = [
        /^(?:find|search|search for|look for|look up)\s+(.+)$/i,
        /^(.+?)(?:\s+on\s+.+)?$/i
    ];
    
    for (let pattern of searchPatterns) {
        const match = task.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return task;
}

async function analyzeWithGemini(task, screenshot, apiKey, tabUrl = '') {
    // Using Gemini 2.5 Flash - the latest model with thinking capabilities
    const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    
    // Extract the actual search term if it's a search task
    const searchTerm = extractSearchTerm(task);
    
    try {
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: `You are a web automation assistant. 
                        Original task: "${task}"
                        ${task.toLowerCase().includes('find') || task.toLowerCase().includes('search') ? `Search term to use: "${searchTerm}"` : ''}
                        
                        CRITICAL RULES FOR TYPING:
                        1. NEVER type the full task phrase in search boxes
                        2. For search tasks, ONLY type the search term provided above
                        3. Example: If task is "find coffee", you must type "coffee" only
                        
                        IMPORTANT:
                        - Click the search input first
                        - Type EXACTLY the search term: "${searchTerm}"
                        - Do NOT type "${task}"
                        - Submit the search
                        
                        Current page: ${tabUrl || 'unknown'}
                        
                        WORKFLOW ANALYSIS:
                        - If the task is "search for X", generate ALL steps: navigate (if needed) → click search box → type query → submit search → wait for results
                        - If the task is "buy X", generate: search → find product → click product → add to cart → etc.
                        - If the task is "fill form", generate: find each field → fill each field → submit form
                        - Always include wait actions after page changes
                        
                        Supported action types:
                        1. "navigate" - Go to a URL {"type": "navigate", "url": "https://..."}
                        2. "click" - Click element {"type": "click", "selector": "...", "description": "..."}
                        3. "type" - Type text {"type": "type", "selector": "...", "text": "...", "description": "..."}
                        4. "press_enter" - Press Enter key {"type": "press_enter", "description": "Submit search"}
                        5. "wait" - Wait for loading {"type": "wait", "duration": 2000, "description": "..."}
                        6. "scroll" - Scroll page {"type": "scroll", "direction": "down", "amount": 300}
                        7. "select" - Select dropdown {"type": "select", "selector": "...", "value": "..."}
                        
                        EXAMPLES - FOLLOW THESE EXACTLY:
                        
                        Task: "find coffee"
                        [
                            {"type": "click", "description": "Click search input", "selector": "input[name='q']"},
                            {"type": "type", "description": "Type coffee", "selector": "input[name='q']", "text": "coffee"},
                            {"type": "press_enter", "description": "Submit search"},
                            {"type": "wait", "description": "Wait for results", "duration": 2000}
                        ]
                        
                        Task: "search laptops"
                        [
                            {"type": "click", "description": "Click search box", "selector": "input[type='search']"},
                            {"type": "type", "description": "Type laptops", "selector": "input[type='search']", "text": "laptops"},
                            {"type": "press_enter", "description": "Search"},
                            {"type": "wait", "description": "Wait", "duration": 2000}
                        ]
                        
                        Task: "find cheap flights to Paris"
                        [
                            {"type": "navigate", "description": "Go to flight search", "url": "https://www.google.com/travel/flights"},
                            {"type": "wait", "description": "Wait for page", "duration": 1500},
                            {"type": "click", "description": "Click destination field", "selector": "input[placeholder*='Where to']"},
                            {"type": "type", "description": "Enter destination", "selector": "input[placeholder*='Where to']", "text": "Paris"},
                            {"type": "wait", "description": "Wait for suggestions", "duration": 1000},
                            {"type": "click", "description": "Select Paris from suggestions", "selector": "li[role='option']:first-child"},
                            {"type": "click", "description": "Search flights", "selector": "button[aria-label*='Search']"},
                            {"type": "wait", "description": "Wait for results", "duration": 3000},
                            {"type": "scroll", "description": "Scroll to see more results", "direction": "down", "amount": 500}
                        ]
                        
                        IMPORTANT RULES:
                        1. ALWAYS think about the complete user journey, not just one action
                        2. If not on the right website for the task, include navigation first
                        3. Include wait actions after any action that causes page changes
                        4. For search tasks: navigate → click input → type → submit → wait for results
                        5. Be thorough - include ALL steps a human would take
                        6. Return ONLY the JSON array, no other text
                        
                        Analyze the current page and generate the complete action sequence:`
                    },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: screenshot.split(',')[1]
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192,  // Increased for Gemini 2.5 Flash (supports up to 65,536)
                responseMimeType: "application/json",
                // Gemini 2.5 Flash has thinking enabled by default
                // The model will reason through the task before generating actions
                topK: 40,
                topP: 0.95
            },
            // Optional: Add safety settings for production use
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }
            ]
        };

        const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API request failed: ${error}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const content = data.candidates[0].content.parts[0].text;
            try {
                const actions = JSON.parse(content);
                return Array.isArray(actions) ? actions : [];
            } catch (parseError) {
                console.error('Failed to parse AI response:', content);
                return [];
            }
        }
        
        return [];
    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

function executeActions() {
    if (!isTaskRunning || currentActionIndex >= actionQueue.length) {
        sendStatusUpdate('Task completed!', 'success', '', 100, true, true);
        stopAutomation();
        return;
    }

    const action = actionQueue[currentActionIndex];
    const progress = Math.round(((currentActionIndex + 1) / actionQueue.length) * 100);
    
    sendStatusUpdate(
        `Executing action ${currentActionIndex + 1} of ${actionQueue.length}`,
        'info',
        action.description,
        progress
    );

    // Send action to content script for execution
    chrome.tabs.sendMessage(currentTabId, {
        action: 'executeAction',
        actionData: action,
        showOverlay: true
    }, (response) => {
        if (chrome.runtime.lastError) {
            sendStatusUpdate('Error executing action: ' + chrome.runtime.lastError.message, 'error');
            stopAutomation();
            return;
        }

        if (response && response.success) {
            currentActionIndex++;
            
            // Add delay between actions for visibility
            setTimeout(() => {
                executeActions();
            }, action.type === 'wait' ? action.duration : 1000);
        } else {
            sendStatusUpdate('Action failed: ' + (response?.error || 'Unknown error'), 'error');
            stopAutomation();
        }
    });
}

function processNextAction() {
    if (!isTaskRunning) return;
    
    currentActionIndex++;
    if (currentActionIndex < actionQueue.length) {
        executeActions();
    } else {
        sendStatusUpdate('All actions completed successfully!', 'success', '', 100, true, true);
        stopAutomation();
    }
}

// Gemini Live Stream Class (integrated directly to avoid module issues)
class GeminiLiveStream {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isStreaming = false;
        this.screenshotInterval = null;
        this.currentTabId = null;
        // Live mode endpoint for audio/video streaming
        this.wsEndpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
    }

    async connect(tabId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }
        this.currentTabId = tabId;
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`${this.wsEndpoint}?key=${this.apiKey}`);
                
                this.ws.onopen = () => {
                    console.log('WebSocket connected to Gemini Live API');
                    this.sendSetupMessage();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('WebSocket connection closed');
                    this.stopStreaming();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    sendSetupMessage() {
        const setupMessage = {
            setup: {
                model: 'gemini-2.0-flash-live',
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            }
        };
        this.sendMessage(setupMessage);
    }

    async startStreaming() {
        if (this.isStreaming) return;
        this.isStreaming = true;
        
        await this.captureAndSendScreenshot();
        
        this.screenshotInterval = setInterval(async () => {
            if (this.isStreaming) {
                await this.captureAndSendScreenshot();
            }
        }, 1000);
    }

    stopStreaming() {
        this.isStreaming = false;
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }

    async captureAndSendScreenshot() {
        if (!this.currentTabId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(this.currentTabId, {
                    action: 'captureScreenshot',
                    options: {
                        maxWidth: 1024,
                        maxHeight: 1024,
                        quality: 0.7
                    }
                }, resolve);
            });

            if (response && response.screenshot) {
                const message = {
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: 'image/jpeg',
                            data: response.screenshot.split(',')[1]
                        }]
                    }
                };
                this.sendMessage(message);
            }
        } catch (error) {
            console.error('Failed to capture/send screenshot:', error);
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            chrome.runtime.sendMessage({
                action: 'liveStreamResponse',
                text: JSON.stringify(message)
            });
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
}

// Live Mode Functions
async function startLiveMode(tabId, apiKey) {
    if (liveStream) {
        sendWorkflowUpdate({ log: 'Live mode already active', logType: 'error' });
        return;
    }

    try {
        // Initialize live stream with integrated class
        liveStream = new GeminiLiveStream(apiKey);
        
        sendWorkflowUpdate({
            log: 'Starting live mode with real-time screen sharing...',
            logType: 'info',
            status: 'Connecting to Gemini Live API...'
        });

        // Connect WebSocket
        await liveStream.connect(tabId);
        
        // Start streaming screenshots
        await liveStream.startStreaming();
        
        sendWorkflowUpdate({
            log: '🔴 LIVE MODE ACTIVE - Sharing screen every 1 second',
            logType: 'success',
            status: 'Live streaming active'
        });

        // Listen for live stream responses
        chrome.runtime.onMessage.addListener(handleLiveStreamMessages);
        
    } catch (error) {
        sendWorkflowUpdate({
            log: `Failed to start live mode: ${error.message}`,
            logType: 'error'
        });
        liveStream = null;
    }
}

function stopLiveMode() {
    if (liveStream) {
        liveStream.stopStreaming();
        liveStream = null;
        
        sendWorkflowUpdate({
            log: 'Live mode stopped',
            logType: 'info',
            status: 'Live streaming ended'
        });
        
        // Remove listener
        chrome.runtime.onMessage.removeListener(handleLiveStreamMessages);
    }
}

function sendLiveMessage(message) {
    if (liveStream) {
        liveStream.sendTextMessage(message);
        sendWorkflowUpdate({
            log: `You: ${message}`,
            logType: 'info'
        });
    } else {
        sendWorkflowUpdate({
            log: 'Live mode not active',
            logType: 'error'
        });
    }
}

function handleLiveStreamMessages(request, sender, sendResponse) {
    if (request.action === 'liveStreamReady') {
        sendWorkflowUpdate({
            log: 'Live stream ready for interaction',
            logType: 'success'
        });
    } else if (request.action === 'liveStreamResponse') {
        sendWorkflowUpdate({
            log: `Gemini: ${request.text}`,
            logType: 'info'
        });
    }
}

function stopAutomation() {
    isTaskRunning = false;
    continuousMode = false;
    currentTask = null;
    currentTabId = null;
    actionQueue = [];
    currentActionIndex = 0;
    completedActions = [];
    currentIteration = 0;
    
    // Stop WebSocket workflow if active
    if (webSocketWorkflow) {
        webSocketWorkflow.disconnect();
        webSocketWorkflow = null;
    }
    
    // Stop live mode if active
    if (liveStream) {
        stopLiveMode();
    }
    
    // Notify content script to clean up
    if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'cleanup' }).catch(() => {});
    }
    
    // Notify sidepanel
    sendWorkflowUpdate({
        log: 'Workflow stopped',
        logType: 'info',
        progress: 0
    });
}

function sendStatusUpdate(status, type, currentAction, progress, completed = false, success = false) {
    chrome.runtime.sendMessage({
        action: 'statusUpdate',
        status: status,
        type: type,
        currentAction: currentAction,
        progress: progress,
        completed: completed,
        success: success
    });
}

// Handle tab updates and closures
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentTabId) {
        stopAutomation();
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === currentTabId && changeInfo.status === 'complete' && isTaskRunning) {
        // Re-inject content script if page reloaded during task
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js', 'overlay.js']
        });
    }
});

// WebSocket Workflow class integrated directly
class WebSocketWorkflow {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.currentTask = null;
        this.currentStep = null;
        this.currentTabId = null;
        this.screenshotInterval = null;
        this.lastScreenshot = null;
        this.stuckCounter = 0;
        this.maxStuckAttempts = 5;
        this.stepHistory = [];
        
        // Updated WebSocket endpoint for Gemini 2.0 Flash
        this.wsEndpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
        
        this.config = {
            screenshotInterval: 1000,
            model: 'gemini-2.5-flash',
            temperature: 0.3,
            maxOutputTokens: 4096
        };
    }

    async connect(tabId) {
        this.currentTabId = tabId;
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`${this.wsEndpoint}?key=${this.apiKey}`);
                
                this.ws.onopen = () => {
                    console.log('WebSocket connected to Gemini');
                    this.isConnected = true;
                    this.sendInitialSetup();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleGeminiResponse(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnected = false;
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.isConnected = false;
                    this.stopScreenshotStream();
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }

    sendInitialSetup() {
        const setupMessage = {
            setup: {
                model: 'models/gemini-2.0-flash-exp', // Use latest Gemini 2.0 model
                generationConfig: {
                    temperature: this.config.temperature,
                    maxOutputTokens: this.config.maxOutputTokens,
                    responseMimeType: 'application/json'
                },
                systemInstruction: {
                    parts: [{
                        text: `You are an intelligent web automation assistant with real-time visual access.
                        
                        WORKFLOW PROTOCOL:
                        1. You will receive a task and continuous screenshots
                        2. Analyze the current state and provide ONE next action
                        3. After each action, you'll receive a new screenshot
                        4. Continue until task is complete or user stops
                        
                        RESPONSE FORMAT (JSON):
                        {
                            "status": "in_progress|completed|stuck|error",
                            "current_analysis": "What I see on the screen",
                            "next_action": {
                                "type": "click|type|scroll|wait|navigate|press_enter",
                                "selector": "CSS selector or description",
                                "value": "text to type or URL",
                                "description": "What this action does"
                            },
                            "reason": "Why this action is needed",
                            "progress": "X% - progress estimate",
                            "stuck_reason": "If stuck, explain why"
                        }
                        
                        IMPORTANT RULES:
                        - Provide only ONE action at a time
                        - Wait for screenshot update after each action
                        - If you see a popup or unexpected element, handle it
                        - If stuck on same screen for 3+ attempts, try alternative approach
                        - For search tasks, type ONLY the search term, not the full command
                        - Always be specific with selectors`
                    }]
                }
            }
        };
        
        this.sendMessage(setupMessage);
    }

    async startTask(task) {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }
        
        this.currentTask = task;
        this.stepHistory = [];
        this.stuckCounter = 0;
        
        const screenshot = await this.captureScreenshot();
        
        const taskMessage = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        {
                            text: `NEW TASK: ${task}
                            
                            Please analyze the current screen and provide the first action.
                            Remember: For search tasks like "find X", type only "X" in the search box.`
                        },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: screenshot.split(',')[1]
                            }
                        }
                    ]
                }]
            }
        };
        
        this.sendMessage(taskMessage);
        this.startScreenshotStream();
        
        console.log(`Task started: ${task}`);
    }

    startScreenshotStream() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
        }
        
        this.screenshotInterval = setInterval(async () => {
            if (!this.isConnected || !this.currentTask) return;
            
            try {
                const screenshot = await this.captureScreenshot();
                
                if (screenshot === this.lastScreenshot) {
                    this.stuckCounter++;
                    
                    if (this.stuckCounter >= this.maxStuckAttempts) {
                        this.sendScreenshotUpdate(screenshot, true);
                    }
                } else {
                    this.stuckCounter = 0;
                    this.lastScreenshot = screenshot;
                    
                    if (this.currentStep) {
                        this.sendScreenshotUpdate(screenshot, false);
                    }
                }
            } catch (error) {
                console.error('Screenshot stream error:', error);
            }
        }, this.config.screenshotInterval);
        
        console.log('Screenshot streaming started (every 1 second)');
    }

    stopScreenshotStream() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
            console.log('Screenshot streaming stopped');
        }
    }

    sendScreenshotUpdate(screenshot, isStuck = false) {
        const updateMessage = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        {
                            text: isStuck ? 
                                `ATTENTION: Screen hasn't changed for ${this.stuckCounter} seconds.
                                Current step: ${this.currentStep?.description || 'Unknown'}
                                Possible issues: popup, error message, wrong selector, or page not responding.
                                Please analyze and provide alternative action or handle the obstacle.` :
                                `Screenshot update after action: ${this.currentStep?.description || 'Unknown'}
                                Please analyze the result and provide the next action.
                                Task: ${this.currentTask}`
                        },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: screenshot.split(',')[1]
                            }
                        }
                    ]
                }]
            }
        };
        
        this.sendMessage(updateMessage);
    }

    async captureScreenshot() {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(this.currentTabId, {
                action: 'captureScreenshot',
                options: {
                    maxWidth: 1280,
                    maxHeight: 720,
                    quality: 0.8
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.screenshot) {
                    resolve(response.screenshot);
                } else {
                    reject(new Error('Failed to capture screenshot'));
                }
            });
        });
    }

    handleGeminiResponse(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.serverContent) {
                const content = message.serverContent;
                if (content.modelTurn && content.modelTurn.parts) {
                    content.modelTurn.parts.forEach(part => {
                        if (part.text) {
                            this.processActionResponse(part.text);
                        }
                    });
                }
            } else if (message.setupComplete) {
                console.log('Setup complete, ready for tasks');
                this.notifyUI('ready', 'WebSocket ready for tasks');
            }
        } catch (error) {
            console.error('Failed to parse Gemini response:', error);
        }
    }

    processActionResponse(responseText) {
        try {
            const response = JSON.parse(responseText);
            
            console.log('Gemini response:', response);
            
            this.notifyUI('analysis', response.current_analysis);
            this.notifyUI('progress', response.progress);
            
            switch (response.status) {
                case 'completed':
                    this.handleTaskCompletion(response);
                    break;
                    
                case 'stuck':
                    this.handleStuckSituation(response);
                    break;
                    
                case 'error':
                    this.handleError(response);
                    break;
                    
                case 'in_progress':
                default:
                    this.executeNextAction(response.next_action);
                    break;
            }
            
        } catch (error) {
            console.log('Gemini says:', responseText);
            this.notifyUI('message', responseText);
        }
    }

    async executeNextAction(action) {
        if (!action) {
            console.error('No action provided');
            return;
        }
        
        this.currentStep = action;
        this.stepHistory.push(action);
        
        console.log(`Executing: ${action.type} - ${action.description}`);
        this.notifyUI('action', `${action.type}: ${action.description}`);
        
        chrome.tabs.sendMessage(this.currentTabId, {
            action: 'executeAction',
            actionData: action,
            showOverlay: true
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Action execution error:', chrome.runtime.lastError);
                this.handleExecutionError(chrome.runtime.lastError.message);
            } else if (response && response.success) {
                console.log('Action executed successfully');
            } else {
                console.error('Action failed:', response?.error);
                this.handleExecutionError(response?.error);
            }
        });
    }

    handleTaskCompletion(response) {
        console.log('Task completed successfully!');
        this.notifyUI('completed', response.current_analysis);
        this.stopScreenshotStream();
        this.currentTask = null;
        this.currentStep = null;
    }

    handleStuckSituation(response) {
        console.log('Stuck detected:', response.stuck_reason);
        this.notifyUI('stuck', response.stuck_reason);
        
        if (response.next_action) {
            this.executeNextAction(response.next_action);
        } else {
            this.notifyUI('need_help', 'The automation is stuck and needs your help');
        }
    }

    handleError(response) {
        console.error('Task error:', response);
        this.notifyUI('error', response.reason || 'Unknown error occurred');
        this.stopScreenshotStream();
    }

    handleExecutionError(error) {
        this.captureScreenshot().then(screenshot => {
            const errorMessage = {
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [
                            {
                                text: `ERROR executing action: ${error}
                                Last action attempted: ${this.currentStep?.description}
                                Please analyze the screen and provide an alternative approach.`
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: screenshot.split(',')[1]
                                }
                            }
                        ]
                    }]
                }
            };
            this.sendMessage(errorMessage);
        });
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not ready');
        }
    }

    notifyUI(type, data) {
        chrome.runtime.sendMessage({
            action: 'workflowUpdate',
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        }).catch(() => {});
    }

    stopTask() {
        console.log('Stopping task');
        this.stopScreenshotStream();
        this.currentTask = null;
        this.currentStep = null;
        this.stepHistory = [];
        this.stuckCounter = 0;
        this.notifyUI('stopped', 'Task stopped by user');
    }

    disconnect() {
        this.stopTask();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Start WebSocket workflow
async function startWebSocketWorkflow(task, tabId, apiKey) {
    if (webSocketWorkflow) {
        sendWorkflowUpdate({ log: 'WebSocket workflow already running', logType: 'error' });
        return;
    }

    try {
        // Initialize WebSocket workflow
        webSocketWorkflow = new WebSocketWorkflow(apiKey);
        
        sendWorkflowUpdate({
            log: 'Initializing WebSocket workflow...',
            logType: 'info',
            status: 'Connecting to Gemini...'
        });

        // Connect to WebSocket
        await webSocketWorkflow.connect(tabId);
        
        sendWorkflowUpdate({
            log: '✓ Connected to Gemini WebSocket',
            logType: 'success',
            status: 'Starting task...'
        });

        // Start the task
        await webSocketWorkflow.startTask(task);
        
        sendWorkflowUpdate({
            log: `Task started: ${task}`,
            logType: 'info',
            status: 'Executing with real-time feedback...'
        });
        
    } catch (error) {
        sendWorkflowUpdate({
            log: `WebSocket workflow error: ${error.message}`,
            logType: 'error'
        });
        
        if (webSocketWorkflow) {
            webSocketWorkflow.disconnect();
            webSocketWorkflow = null;
        }
    }
}

// Start multi-tab workflow
async function startMultiTabWorkflow(task, apiKey) {
    try {
        // Initialize multi-tab manager if not exists
        if (!multiTabManager) {
            // Import MultiTabManager class (defined below)
            multiTabManager = new MultiTabManager();
        }
        
        sendWorkflowUpdate({
            log: 'Starting multi-tab workflow...',
            logType: 'info',
            status: 'Analyzing task requirements...'
        });
        
        // Create and execute workflow
        const workflowId = await multiTabManager.createWorkflow(task, apiKey);
        
        sendWorkflowUpdate({
            log: `Multi-tab workflow started: ${workflowId}`,
            logType: 'success',
            status: 'Coordinating across multiple tabs...'
        });
        
    } catch (error) {
        sendWorkflowUpdate({
            log: `Multi-tab workflow error: ${error.message}`,
            logType: 'error'
        });
    }
}// Simplified Multi-Tab Manager for coordinating across tabs
class MultiTabManager {
    constructor() {
        this.activeTabs = new Map();
        this.workflows = new Map();
        this.tabConnections = new Map();
    }

    async createWorkflow(task, apiKey) {
        const workflowId = `workflow_${Date.now()}`;
        const workflow = {
            id: workflowId,
            task: task,
            status: 'initializing',
            tabs: [],
            startTime: Date.now()
        };
        
        this.workflows.set(workflowId, workflow);
        
        // Analyze task and create tabs
        const requiredTabs = this.analyzeTask(task);
        
        sendWorkflowUpdate({
            log: `Creating ${requiredTabs.length} tabs for workflow`,
            logType: 'info'
        });
        
        // Create tabs
        for (const tabConfig of requiredTabs) {
            const tab = await this.createTab(tabConfig.url);
            workflow.tabs.push(tab.id);
            
            sendWorkflowUpdate({
                log: `Opened tab: ${tabConfig.purpose} - ${tabConfig.url}`,
                logType: 'success'
            });
            
            // Wait for tab to load
            await this.waitForTabLoad(tab.id);
            
            // Establish WebSocket connection for tab
            const connection = new TabConnection(tab.id, apiKey);
            await connection.connect();
            this.tabConnections.set(tab.id, connection);
        }
        
        // Execute workflow
        await this.executeWorkflow(workflowId, task);
        
        return workflowId;
    }

    analyzeTask(task) {
        const taskLower = task.toLowerCase();
        const tabs = [];
        
        // Price comparison
        if (taskLower.includes('compare') && (taskLower.includes('price') || taskLower.includes('product'))) {
            tabs.push(
                { url: 'https://www.amazon.com', purpose: 'Amazon prices' },
                { url: 'https://www.ebay.com', purpose: 'eBay prices' }
            );
        }
        // Flight/travel
        else if (taskLower.includes('flight') || taskLower.includes('travel')) {
            tabs.push(
                { url: 'https://www.google.com/travel/flights', purpose: 'Google Flights' },
                { url: 'https://www.kayak.com', purpose: 'Kayak comparison' }
            );
        }
        // Restaurant booking
        else if (taskLower.includes('restaurant') || taskLower.includes('reservation')) {
            tabs.push(
                { url: 'https://www.opentable.com', purpose: 'OpenTable reservations' },
                { url: 'https://www.yelp.com', purpose: 'Yelp reviews' }
            );
        }
        // Research
        else if (taskLower.includes('research')) {
            tabs.push(
                { url: 'https://www.google.com', purpose: 'Google search' },
                { url: 'https://scholar.google.com', purpose: 'Academic search' }
            );
        }
        // Default: single Google tab
        else {
            tabs.push({ url: 'https://www.google.com', purpose: 'General search' });
        }
        
        return tabs;
    }

    async createTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.create({ url: url, active: false }, (tab) => {
                this.activeTabs.set(tab.id, { url: url, created: Date.now() });
                resolve(tab);
            });
        });
    }

    async waitForTabLoad(tabId) {
        return new Promise((resolve) => {
            const listener = (id, changeInfo) => {
                if (id === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async executeWorkflow(workflowId, task) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return;
        
        workflow.status = 'executing';
        
        sendWorkflowUpdate({
            log: 'Coordinating actions across tabs...',
            logType: 'info',
            progress: 50
        });
        
        // Execute task on each tab
        const results = [];
        for (const tabId of workflow.tabs) {
            const connection = this.tabConnections.get(tabId);
            if (connection) {
                const result = await connection.executeTask(task);
                results.push({ tabId, result });
            }
        }
        
        // Aggregate results
        sendWorkflowUpdate({
            log: 'Workflow completed across all tabs',
            logType: 'success',
            progress: 100
        });
        
        workflow.status = 'completed';
        return results;
    }
}

// Simplified tab connection for multi-tab workflows
class TabConnection {
    constructor(tabId, apiKey) {
        this.tabId = tabId;
        this.apiKey = apiKey;
        this.ws = null;
    }

    async connect() {
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.sendSetup();
                resolve();
            };
            
            this.ws.onerror = reject;
        });
    }

    sendSetup() {
        const setup = {
            setup: {
                model: 'models/gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048
                }
            }
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(setup));
        }
    }

    async executeTask(task) {
        // Capture screenshot and send task
        const screenshot = await this.captureScreenshot();
        
        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        { text: task },
                        { inlineData: { mimeType: 'image/jpeg', data: screenshot.split(',')[1] } }
                    ]
                }],
                turnComplete: true
            }
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        
        return { success: true };
    }

    async captureScreenshot() {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'captureScreenshot'
            }, (response) => {
                resolve(response?.screenshot || '');
            });
        });
    }
}