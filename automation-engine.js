// Comprehensive Browser Automation Engine
// This file contains all the logic for controlling the browser

class BrowserAutomationEngine {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.currentTask = null;
        this.messageBuffer = '';
        this.actionQueue = [];
        this.isExecuting = false;
    }

    // Initialize the engine
    async initialize() {
        console.log('🚀 Initializing Browser Automation Engine');
        
        // Set up side panel
        await chrome.sidePanel.setOptions({
            path: 'simple-chat.html',
            enabled: true
        });
        
        await chrome.sidePanel.setPanelBehavior({ 
            openPanelOnActionClick: true 
        });

        // Listen for messages
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Load saved API key
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
            console.log('✅ API key loaded');
        }
    }

    // Handle messages from UI and content scripts
    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Received message:', request.action);
        
        switch (request.action) {
            case 'SET_API_KEY':
                this.apiKey = request.data.apiKey;
                sendResponse({ success: true });
                break;

            case 'START_AUTOMATION':
                const result = await this.startAutomation(request.data.tabId, request.data.task);
                sendResponse({ success: result });
                break;

            case 'STOP_AUTOMATION':
                this.stopAutomation();
                sendResponse({ success: true });
                break;

            case 'EXECUTE_TASK':
                await this.executeTask(request.data.task);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    // Start automation with Gemini
    async startAutomation(tabId, initialTask) {
        if (!this.apiKey) {
            this.notify('error', 'Please set your API key first');
            return false;
        }

        this.activeTabId = tabId;
        this.currentTask = initialTask;
        
        console.log('🎯 Starting automation for task:', initialTask);
        
        // Connect to Gemini
        const connected = await this.connectToGemini();
        if (!connected) {
            this.notify('error', 'Failed to connect to Gemini');
            return false;
        }

        // Send initial task with screenshot
        await this.sendTaskToAI(initialTask);
        return true;
    }

    // Connect to Gemini WebSocket
    async connectToGemini() {
        return new Promise((resolve) => {
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
            
            console.log('🔌 Connecting to Gemini...');
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = async () => {
                console.log('✅ WebSocket connected');
                
                // Send setup message
                const setup = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generationConfig: {
                            responseModalities: ["TEXT"],
                            temperature: 0.7,
                            topP: 0.95,
                            maxOutputTokens: 2048
                        },
                        systemInstruction: {
                            parts: [{
                                text: `You are a browser automation expert. You help users complete tasks by controlling their browser.

When given a task and screenshot, you MUST respond with a JSON array of actions to perform.

AVAILABLE ACTIONS:
- click: Click an element
  {"action": "click", "selector": "CSS selector or text", "wait": 1000}
  
- type: Type text in an input
  {"action": "type", "selector": "CSS selector", "text": "text to type", "clear": true}
  
- scroll: Scroll the page
  {"action": "scroll", "direction": "down|up", "amount": 500}
  
- navigate: Go to a URL
  {"action": "navigate", "url": "https://example.com"}
  
- wait: Wait for element or time
  {"action": "wait", "time": 2000}
  
- select: Select dropdown option
  {"action": "select", "selector": "CSS selector", "value": "option value"}
  
- press: Press a key
  {"action": "press", "key": "Enter|Tab|Escape"}

RESPONSE FORMAT:
You must respond with ONLY a JSON object like this:
{
  "thought": "Brief explanation of what you're doing",
  "actions": [
    {"action": "type", "selector": "input[name='search']", "text": "coffee"},
    {"action": "click", "selector": "button[type='submit']"}
  ],
  "complete": false,
  "nextStep": "Wait for search results to load"
}

Set "complete": true when the task is fully done.

IMPORTANT RULES:
1. Always use specific CSS selectors when possible
2. Common selectors: input[name='q'], button[type='submit'], a[href*='login']
3. Add wait actions between steps when needed
4. Break complex tasks into small steps
5. Verify each action before moving to next`
                            }]
                        }
                    }
                };

                this.websocket.send(JSON.stringify(setup));
                
                // Wait for setup complete
                this.websocket.onmessage = (event) => {
                    this.handleGeminiMessage(event);
                };
            };

            this.websocket.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                resolve(false);
            };

            this.websocket.onclose = () => {
                console.log('🔌 WebSocket closed');
                this.isConnected = false;
                this.notify('status', 'Disconnected');
            };

            // Wait for setup to complete
            setTimeout(() => {
                if (this.websocket.readyState === WebSocket.OPEN) {
                    this.isConnected = true;
                    this.notify('status', 'Connected to AI');
                    resolve(true);
                } else {
                    resolve(false);
                }
            }, 2000);
        });
    }

    // Handle messages from Gemini
    async handleGeminiMessage(event) {
        try {
            // Handle both text and blob messages
            let messageText;
            if (event.data instanceof Blob) {
                messageText = await event.data.text();
            } else {
                messageText = event.data;
            }

            const data = JSON.parse(messageText);
            
            // Check for setup complete
            if (data.setupComplete) {
                console.log('✅ Gemini setup complete');
                this.isConnected = true;
                return;
            }

            // Handle server content (AI responses)
            if (data.serverContent) {
                // Accumulate response parts
                if (data.serverContent.modelTurn?.parts) {
                    for (const part of data.serverContent.modelTurn.parts) {
                        if (part.text) {
                            this.messageBuffer += part.text;
                        }
                    }
                }

                // Process complete response when turn is done
                if (data.serverContent.turnComplete) {
                    console.log('📝 Complete AI response:', this.messageBuffer);
                    await this.processAIResponse(this.messageBuffer);
                    this.messageBuffer = '';
                }
            }
        } catch (error) {
            console.error('Error handling Gemini message:', error);
        }
    }

    // Process AI response and execute actions
    async processAIResponse(responseText) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in response');
                this.notify('error', 'AI response was not in expected format');
                return;
            }

            const response = JSON.parse(jsonMatch[0]);
            console.log('🤖 AI Plan:', response);

            // Show AI's thought
            if (response.thought) {
                this.notify('message', `AI: ${response.thought}`);
            }

            // Execute actions
            if (response.actions && response.actions.length > 0) {
                console.log(`⚡ Executing ${response.actions.length} actions`);
                
                for (const action of response.actions) {
                    await this.executeAction(action);
                    // Wait between actions
                    await this.sleep(500);
                }
            }

            // Check if task is complete
            if (response.complete) {
                this.notify('success', '✅ Task completed!');
                console.log('🎉 Task completed successfully');
            } else if (response.nextStep) {
                // Continue with next step
                console.log('➡️ Next step:', response.nextStep);
                this.notify('status', `Next: ${response.nextStep}`);
                
                // Send updated screenshot for next step
                setTimeout(() => {
                    this.sendTaskToAI('continue');
                }, 2000);
            }
        } catch (error) {
            console.error('Error processing AI response:', error);
            this.notify('error', 'Failed to process AI response');
        }
    }

    // Execute a single action
    async executeAction(action) {
        console.log('🎬 Executing action:', action);
        
        try {
            // Ensure content script is ready
            await this.ensureContentScript();
            
            // Send action to content script
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'EXECUTE_ACTION',
                data: action
            });

            if (response.success) {
                console.log('✅ Action executed:', action.action);
                this.notify('action', `Executed: ${action.action}`);
            } else {
                console.error('❌ Action failed:', response.error);
                this.notify('error', `Failed: ${action.action}`);
            }

            // Wait if specified
            if (action.wait) {
                await this.sleep(action.wait);
            }

            return response;
        } catch (error) {
            console.error('Error executing action:', error);
            return { success: false, error: error.message };
        }
    }

    // Send task to AI with screenshot
    async sendTaskToAI(task) {
        if (!this.isConnected) {
            console.error('Not connected to Gemini');
            return;
        }

        // Capture screenshot
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            console.error('Failed to capture screenshot');
            return;
        }

        // Build message
        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: screenshot.split(',')[1]
                            }
                        },
                        {
                            text: task === 'continue' 
                                ? "Continue with the next step of the task. What should I do now?"
                                : `Task: ${task}\n\nAnalyze the screenshot and provide the JSON actions to complete this task.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        console.log('📤 Sending task to AI:', task);
        this.websocket.send(JSON.stringify(message));
    }

    // Capture screenshot of current tab
    async captureScreenshot() {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 90
            });
            console.log('📸 Screenshot captured');
            return dataUrl;
        } catch (error) {
            console.error('Screenshot failed:', error);
            return null;
        }
    }

    // Ensure content script is injected
    async ensureContentScript() {
        try {
            // Try to ping content script
            await chrome.tabs.sendMessage(this.activeTabId, { action: 'PING' });
        } catch (error) {
            // Inject content script if not present
            console.log('Injecting content script...');
            await chrome.scripting.executeScript({
                target: { tabId: this.activeTabId },
                files: ['browser-controller.js']
            });
            await this.sleep(500);
        }
    }

    // Send notification to UI
    notify(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message }
        }).catch(() => {
            // UI might not be open
        });
    }

    // Stop automation
    stopAutomation() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        this.currentTask = null;
        this.notify('status', 'Automation stopped');
    }

    // Utility: sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Execute a complex task by breaking it down
    async executeTask(task) {
        console.log('📋 Executing complex task:', task);
        
        // This will send the task to AI which will break it down
        await this.sendTaskToAI(task);
    }
}

// Initialize the engine
const automationEngine = new BrowserAutomationEngine();
automationEngine.initialize();