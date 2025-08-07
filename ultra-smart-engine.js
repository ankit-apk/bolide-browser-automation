// Ultra-Smart Browser Automation Engine
// Implements advanced Gemini capabilities for maximum intelligence

class UltraSmartEngine {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        
        // Ultra-smart features
        this.memory = {
            session: {
                visitedPages: [],
                successfulPatterns: {},
                failedSelectors: new Set(),
                pageLayouts: {},
                elementCache: new Map()
            },
            learned: {}
        };
        
        this.context = {
            currentUrl: null,
            pageType: null,
            currentState: null,
            taskProgress: [],
            confidence: 0
        };
        
        this.reasoning = {
            observations: [],
            hypotheses: [],
            decisions: []
        };
        
        this.messageBuffer = '';
    }

    async initialize() {
        console.log('🚀 Initializing Ultra-Smart Engine with Advanced AI');
        
        try {
            await chrome.sidePanel.setOptions({
                path: 'simple-chat.html',
                enabled: true
            });
            
            await chrome.sidePanel.setPanelBehavior({ 
                openPanelOnActionClick: true 
            });
        } catch (error) {
            console.error('Side panel setup error:', error);
        }

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        const result = await chrome.storage.local.get(['geminiApiKey', 'learnedPatterns']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
        }
        if (result.learnedPatterns) {
            this.memory.learned = result.learnedPatterns;
        }
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Message:', request.action);
        
        try {
            switch (request.action) {
                case 'SET_API_KEY':
                    this.apiKey = request.data.apiKey;
                    await chrome.storage.local.set({ geminiApiKey: this.apiKey });
                    sendResponse({ success: true });
                    break;

                case 'START_AUTOMATION':
                    const result = await this.startAutomation(request.data.tabId, request.data.task);
                    sendResponse({ success: result });
                    break;

                case 'EXECUTE_TASK':
                    console.log('📝 Received EXECUTE_TASK:', request.data.task);
                    if (!this.isConnected) {
                        console.error('Not connected to AI');
                        this.notify('error', '❌ Not connected. Please restart.');
                        sendResponse({ success: false, error: 'Not connected' });
                    } else {
                        await this.executeTask(request.data.task);
                        sendResponse({ success: true });
                    }
                    break;

                case 'STOP_AUTOMATION':
                    this.stopAutomation();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false });
            }
        } catch (error) {
            console.error('Error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startAutomation(tabId, task) {
        console.log('🚀 Starting Ultra-Smart automation');
        console.log('Tab ID:', tabId, 'Task:', task);
        
        this.activeTabId = tabId;
        
        // Analyze current page context
        await this.analyzePageContext();
        
        // Connect with enhanced capabilities
        this.notify('status', '🔌 Connecting to Ultra-Smart AI...');
        const connected = await this.connectToGemini();
        
        if (!connected) {
            this.notify('error', '❌ Connection failed');
            return false;
        }

        console.log('✅ Connected successfully');
        this.notify('status', '✅ Ultra-Smart Mode Active');
        
        // Wait a moment for connection to stabilize
        await this.sleep(500);
        
        if (task && task !== 'Ready to help. What would you like me to do?') {
            console.log('Executing initial task:', task);
            await this.executeTask(task);
        }

        return true;
    }

    async connectToGemini() {
        return new Promise((resolve) => {
            try {
                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                
                this.websocket = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    if (!this.isConnected) {
                        this.websocket.close();
                        resolve(false);
                    }
                }, 10000);

                this.websocket.onopen = async () => {
                    clearTimeout(timeout);
                    
                    const setup = {
                        setup: {
                            model: "models/gemini-2.0-flash-exp",
                            generationConfig: {
                                responseModalities: ["TEXT"],
                                temperature: 0.4,  // Lower for more consistent behavior
                                topP: 0.8,
                                maxOutputTokens: 4096  // Larger for complex reasoning
                            },
                            systemInstruction: {
                                parts: [{
                                    text: this.getUltraSmartPrompt()
                                }]
                            }
                        }
                    };

                    this.websocket.send(JSON.stringify(setup));
                    
                    const setupHandler = async (event) => {
                        console.log('Setup handler - message type:', typeof event.data);
                        let data;
                        
                        try {
                            if (event.data instanceof Blob) {
                                console.log('Converting Blob to text...');
                                const text = await event.data.text();
                                console.log('Blob text:', text);
                                data = JSON.parse(text);
                            } else {
                                data = JSON.parse(event.data);
                            }
                            
                            console.log('Parsed setup data:', data);
                            
                            if (data.setupComplete) {
                                console.log('✅ Setup complete confirmed!');
                                this.isConnected = true;
                                this.websocket.removeEventListener('message', setupHandler);
                                
                                // Notify UI of successful connection
                                this.notify('status', '✅ Connected to Ultra-Smart AI');
                                
                                resolve(true);
                            }
                        } catch (error) {
                            console.error('Setup handler error:', error);
                        }
                    };
                    
                    this.websocket.addEventListener('message', setupHandler);
                };

                this.websocket.onmessage = async (event) => {
                    if (!this.isConnected) return;
                    await this.handleGeminiMessage(event);
                };

                this.websocket.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };

                this.websocket.onclose = () => {
                    this.isConnected = false;
                    this.notify('status', '⚠️ Disconnected');
                };

            } catch (error) {
                console.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    async handleGeminiMessage(event) {
        console.log('📨 Gemini message received, type:', typeof event.data);
        
        let data;
        try {
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                console.log('Blob message:', text.substring(0, 100));
                data = JSON.parse(text);
            } else {
                data = JSON.parse(event.data);
            }
        } catch (error) {
            console.error('Error parsing Gemini message:', error);
            return;
        }

        if (data.serverContent) {
            console.log('Server content received');
            
            if (data.serverContent.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.text) {
                        console.log('Accumulating text:', part.text.substring(0, 50) + '...');
                        this.messageBuffer += part.text;
                    }
                }
            }

            if (data.serverContent.turnComplete) {
                console.log('Turn complete, processing response');
                console.log('Buffer length:', this.messageBuffer.length);
                
                if (this.messageBuffer.length > 0) {
                    await this.processUltraSmartResponse(this.messageBuffer);
                    this.messageBuffer = '';
                } else {
                    console.warn('Empty message buffer on turn complete');
                }
            }
        }
    }

    async processUltraSmartResponse(responseText) {
        console.log('🧠 Ultra-Smart Response:', responseText);
        
        try {
            // Extract JSON from response
            let cleanText = responseText;
            if (responseText.includes('```json')) {
                cleanText = responseText.replace(/```json\s*/g, '').replace(/```/g, '');
            } else if (responseText.includes('```')) {
                cleanText = responseText.replace(/```\s*/g, '');
            }
            
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                this.notify('message', responseText);
                return;
            }

            let response;
            try {
                response = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                // Try to fix common JSON issues
                let fixedJson = jsonMatch[0]
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']')
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
                    .replace(/:\s*'([^']*)'/g, ': "$1"')
                    .replace(/"\s*:\s*"([^"]*)"([^,}])/g, '": "$1"$2'); // Fix missing commas
                
                try {
                    response = JSON.parse(fixedJson);
                } catch (e) {
                    console.error('Cannot parse JSON even after fixes:', e);
                    this.notify('error', '❌ Invalid response format');
                    return;
                }
            }
            
            // Process thinking (new feature)
            if (response.thinking) {
                console.log('🤔 AI Thinking Process:');
                console.log('  Current Situation:', response.thinking.current_situation);
                console.log('  Task Understanding:', response.thinking.task_understanding);
                console.log('  Possible Approaches:', response.thinking.possible_approaches);
                console.log('  Chosen Approach:', response.thinking.chosen_approach);
                console.log('  Next Step:', response.thinking.next_immediate_step);
                console.log('  Expected Outcome:', response.thinking.expected_outcome);
                
                // Show thinking to user
                this.notify('message', `🤔 ${response.thinking.next_immediate_step}`);
            }
            
            // Process reasoning chain
            if (response.reasoning) {
                this.processReasoning(response.reasoning);
            }

            // Update context
            if (response.context) {
                this.updateContext(response.context);
            }

            // Execute action with intelligence - ONLY ONE ACTION
            if (response.action) {
                console.log('Action found in response:', response.action);
                await this.executeIntelligentAction(response.action);
            }
            
            // Block multiple actions - we want one at a time
            else if (response.actions && Array.isArray(response.actions)) {
                console.log('⚠️ Multiple actions detected, executing only the first one');
                if (response.actions.length > 0) {
                    await this.executeIntelligentAction(response.actions[0]);
                }
            }

            // Block multi-step plans - we want one step at a time
            else if (response.plan) {
                console.log('⚠️ Multi-step plan detected, executing only the first step');
                if (response.plan.steps && response.plan.steps.length > 0) {
                    await this.executeIntelligentAction(response.plan.steps[0]);
                }
            }

            // Task completion
            else if (response.complete || response.task_complete) {
                this.handleTaskComplete(response);
            }
            
            // If no recognized action format, log for debugging
            else {
                console.log('⚠️ Response has no recognized action format:', response);
                this.notify('error', '❌ Could not understand AI response format');
            }

        } catch (error) {
            console.error('Processing error:', error);
            this.notify('error', '❌ Failed to process response');
        }
    }

    processReasoning(reasoning) {
        console.log('🤔 Chain of Thought:', reasoning);
        
        if (reasoning.observation) {
            this.notify('message', `👁️ ${reasoning.observation}`);
            this.reasoning.observations.push(reasoning.observation);
        }
        
        if (reasoning.inference) {
            console.log('💡 Inference:', reasoning.inference);
            this.reasoning.hypotheses.push(reasoning.inference);
        }
        
        if (reasoning.decision) {
            this.notify('message', `🎯 ${reasoning.decision}`);
            this.reasoning.decisions.push(reasoning.decision);
        }
        
        if (reasoning.confidence) {
            this.context.confidence = reasoning.confidence;
            console.log(`📊 Confidence: ${(reasoning.confidence * 100).toFixed(0)}%`);
        }
    }

    updateContext(context) {
        Object.assign(this.context, context);
        console.log('📍 Context updated:', this.context);
    }

    async executeIntelligentAction(action) {
        console.log('🎬 Intelligent Action:', action);
        
        // Normalize action format
        const normalizedAction = this.normalizeAction(action);
        console.log('Normalized action:', normalizedAction);
        
        // Add to memory
        if (!this.memory.session.taskProgress) {
            this.memory.session.taskProgress = [];
        }
        this.memory.session.taskProgress.push(normalizedAction);
        
        // Visual analysis before action
        if (normalizedAction.visual_check) {
            await this.performVisualCheck(normalizedAction.visual_check);
        }
        
        // Handle navigation specially
        if (normalizedAction.type === 'navigate') {
            console.log('Handling navigation to:', normalizedAction.url);
            try {
                await chrome.tabs.update(this.activeTabId, { url: normalizedAction.url });
                this.notify('action', `✅ Navigating to: ${normalizedAction.url}`);
                this.lastActionResult = true;
                await this.sleep(3000); // Wait for page load
                
                // Update context
                const tab = await chrome.tabs.get(this.activeTabId);
                this.context.currentUrl = tab.url;
                
                // Continue with task after navigation
                await this.continueWithIntelligence();
                return;
            } catch (error) {
                console.error('Navigation error:', error);
                this.notify('error', `❌ Failed to navigate: ${error.message}`);
                this.lastActionResult = false;
                
                // Try recovery
                await this.intelligentRecovery(normalizedAction);
                return;
            }
        }
        
        // Execute with parallel strategies if specified
        let success = false;
        if (normalizedAction.strategies) {
            success = await this.tryParallelStrategies(normalizedAction.strategies);
        } else {
            success = await this.executeAction(normalizedAction);
        }
        
        // Track result
        this.lastActionResult = success;
        
        if (success) {
            this.notify('action', `✅ ${normalizedAction.type}: ${normalizedAction.selector || normalizedAction.url || ''}`);
            
            // Learn from success
            this.learnFromSuccess(normalizedAction);
            
            // Wait for action to complete and page to update
            await this.sleep(normalizedAction.wait || 1500);
            
            // Continue task with state feedback
            await this.continueWithIntelligence();
        } else {
            this.notify('error', `❌ Failed: ${normalizedAction.type}`);
            
            // Track failure
            if (!this.failureCount) this.failureCount = 0;
            this.failureCount++;
            
            // If failed too many times with same approach, force different strategy
            if (this.failureCount >= 3) {
                console.log('Multiple failures detected, requesting completely different approach');
                this.failureCount = 0;
                await this.requestDifferentApproach(normalizedAction);
            } else {
                // Normal intelligent recovery
                await this.intelligentRecovery(normalizedAction);
            }
        }
    }
    
    normalizeAction(action) {
        // Handle different action formats
        const type = action.type || action.action || 'unknown';
        
        // Normalize type names
        let normalizedType = type.toLowerCase();
        if (normalizedType === 'key' || normalizedType === 'keypress') {
            normalizedType = 'press';
        }
        
        return {
            type: normalizedType,
            selector: action.selector || action.target || action.element,
            text: action.text || action.value || action.input,
            url: action.url || action.href,
            wait: action.wait || action.delay || 1000,
            key: action.key || action.value,
            direction: action.direction,
            amount: action.amount,
            strategies: action.strategies,
            clear: action.clear
        };
    }

    async tryParallelStrategies(strategies) {
        console.log('🔄 Trying parallel strategies:', strategies.length);
        
        for (const strategy of strategies) {
            console.log(`  Attempting: ${strategy.method}`);
            const success = await this.executeAction(strategy);
            
            if (success) {
                console.log(`  ✅ Success with: ${strategy.method}`);
                this.memory.session.successfulPatterns[strategy.method] = strategy;
                return true;
            } else {
                this.memory.session.failedSelectors.add(strategy.selector || strategy.method);
            }
        }
        
        return false;
    }

    async performVisualCheck(check) {
        console.log('👁️ Visual Check:', check);
        
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;
        
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
                            text: `Visual Check: ${check}
Analyze the image and confirm if the condition is met.
Respond with: {"visual_result": true/false, "observation": "what you see"}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    learnFromSuccess(action) {
        const url = this.context.currentUrl;
        if (!url) return;
        
        const domain = new URL(url).hostname;
        
        if (!this.memory.learned[domain]) {
            this.memory.learned[domain] = {
                successful_actions: [],
                selectors: {}
            };
        }
        
        this.memory.learned[domain].successful_actions.push({
            action: action.type,
            selector: action.selector,
            context: this.context.pageType,
            timestamp: Date.now()
        });
        
        // Save learned patterns
        this.saveLearnedPatterns();
    }

    async requestDifferentApproach(failedAction) {
        console.log('🔄 Requesting completely different approach after multiple failures');
        
        const pageState = await this.capturePageState();
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;
        
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
                            text: `CRITICAL: NEED COMPLETELY DIFFERENT APPROACH

SITUATION: Multiple attempts have failed. We need a completely different strategy.

CURRENT STATE:
- URL: ${pageState.url}
- Page Type: ${pageState.pageType}
- Failed Action: ${JSON.stringify(failedAction)}
- Total Failures: ${this.memory.session.taskProgress.filter(a => !this.lastActionResult).length}

ORIGINAL TASK: ${this.currentTask}

IMPORTANT INSTRUCTIONS:
1. DO NOT try the same selectors or approaches that have failed
2. Consider completely different ways to achieve the goal:
   - Use keyboard navigation (Tab, Enter, Arrow keys)
   - Try different UI elements (menus, buttons, links)
   - Use browser features (URL manipulation, bookmarks)
   - Look for alternative paths to the same goal
3. If the task seems impossible with current tools, suggest what's blocking us

PROVIDE A COMPLETELY NEW APPROACH WITH DIFFERENT ACTION TYPE OR TARGET.

${this.getUltraSmartPrompt()}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async intelligentRecovery(failedAction) {
        console.log('🔧 Intelligent Recovery for:', failedAction);
        
        const pageState = await this.capturePageState();
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;
        
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
                            text: `INTELLIGENT RECOVERY NEEDED

Failed Action: ${JSON.stringify(failedAction)}
Current Page State:
- URL: ${pageState.url}
- Title: ${pageState.title}
- Page Type: ${pageState.pageType}

Previous Successes: ${JSON.stringify(this.memory.session.successfulPatterns)}
Failed Attempts: ${Array.from(this.memory.session.failedSelectors || [])}

Analyze the screenshot and current state to provide an alternative approach.
Consider:
1. Visual location of target element
2. Alternative selectors or interaction methods
3. Page state issues (loading, popups, overlays)
4. Different UI elements that achieve the same goal

Respond with your reasoning and new action.

${this.getUltraSmartPrompt()}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async executeTask(task) {
        console.log('📋 Executing task with ultra-intelligence:', task);
        
        // Store current task
        this.currentTask = task;
        
        // Notify UI
        this.notify('status', '🧠 Analyzing task...');
        
        // Special handling for Gmail tasks
        if (task.toLowerCase().includes('gmail') || task.toLowerCase().includes('email')) {
            await this.handleGmailTask(task);
            return;
        }
        
        // Analyze task complexity
        const taskAnalysis = await this.analyzeTask(task);
        
        // Get comprehensive screenshot analysis
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            console.error('Failed to capture screenshot');
            this.notify('error', '❌ Cannot capture screenshot. Please ensure you are on a regular webpage.');
            return;
        }
        
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
                            text: `ULTRA-INTELLIGENT TASK EXECUTION

Task: ${task}
Current URL: ${this.context.currentUrl}
Page Type: ${this.context.pageType}
Learned Patterns: ${JSON.stringify(this.memory.learned[new URL(this.context.currentUrl || 'http://unknown').hostname] || {})}

VISUAL ANALYSIS REQUIRED:
1. Identify all interactive regions
2. Understand page layout and structure
3. Locate relevant elements for the task
4. Identify page state (loading, ready, error)

REASONING REQUIRED:
1. Break down the task into steps
2. Consider multiple approaches
3. Predict potential issues
4. Plan verification steps

RESPONSE FORMAT:
{
  "reasoning": {
    "observation": "What I see on the page",
    "inference": "What this means for the task",
    "decision": "The best approach to take",
    "confidence": 0.0-1.0
  },
  "context": {
    "pageType": "search/form/navigation/content",
    "currentState": "ready/loading/error",
    "relevantElements": ["list of found elements"]
  },
  "action": {
    "type": "navigate/click/type/wait",
    "selector": "element identifier",
    "strategies": [
      {"method": "css", "selector": "#id"},
      {"method": "text", "selector": "Click me"},
      {"method": "visual", "selector": "blue button center"}
    ],
    "visual_check": "Verify element is visible and clickable"
  }
}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async handleGmailTask(task) {
        console.log('📧 Handling Gmail-specific task:', task);
        
        // Check if we're on Gmail
        const tab = await chrome.tabs.get(this.activeTabId);
        if (!tab.url.includes('mail.google.com')) {
            console.log('Not on Gmail, navigating...');
            await chrome.tabs.update(this.activeTabId, { url: 'https://mail.google.com/' });
            await this.sleep(3000);
        }
        
        // Get screenshot
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            this.notify('error', '❌ Cannot capture Gmail screenshot');
            return;
        }
        
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
                            text: `GMAIL TASK EXECUTION

Task: ${task}

IMPORTANT GMAIL-SPECIFIC INSTRUCTIONS:
1. To filter unread emails, look for the search box and type "is:unread" then press Enter
2. To click on emails, target elements with class "zA" (email rows)
3. Unread emails have class "zE" in addition to "zA"
4. The search box can be found with: input[placeholder="Search mail"]
5. If you need to open an email, click on the tr.zA element

SIMPLIFIED APPROACH:
- If the task is to read unread emails, first type "is:unread" in the search box
- Then click on the first email in the filtered results
- Use simple, direct selectors

${this.getUltraSmartPrompt()}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async analyzeTask(task) {
        // Simple task analysis - could be enhanced with NLP
        const analysis = {
            complexity: 'medium',
            steps_estimated: 3,
            requires_navigation: task.toLowerCase().includes('go to'),
            requires_search: task.toLowerCase().includes('search') || task.toLowerCase().includes('find'),
            requires_form: task.toLowerCase().includes('fill') || task.toLowerCase().includes('submit')
        };
        
        console.log('📊 Task Analysis:', analysis);
        return analysis;
    }

    async capturePageState() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            
            // Get page information from content script
            let pageInfo = { visibleElements: [] };
            try {
                const response = await chrome.tabs.sendMessage(this.activeTabId, {
                    action: 'ANALYZE_PAGE'
                });
                if (response) {
                    pageInfo = response;
                }
            } catch (e) {
                console.log('Could not get page analysis from content script');
            }
            
            // Determine page type
            const url = new URL(tab.url);
            let pageType = 'general';
            if (url.hostname.includes('google')) {
                if (url.hostname.includes('maps')) {
                    pageType = 'maps';
                } else if (url.hostname.includes('mail')) {
                    pageType = 'email';
                } else {
                    pageType = 'search';
                }
            }
            
            return {
                url: tab.url,
                title: tab.title,
                pageType: pageType,
                visibleElements: pageInfo.interactiveElements || [],
                forms: pageInfo.forms || [],
                state: pageInfo.state || 'ready'
            };
        } catch (error) {
            console.error('Error capturing page state:', error);
            return {
                url: 'unknown',
                title: 'unknown',
                pageType: 'unknown',
                visibleElements: [],
                forms: [],
                state: 'error'
            };
        }
    }

    async analyzePageContext() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            this.context.currentUrl = tab.url;
            
            // Determine page type from URL
            const url = new URL(tab.url);
            if (url.hostname.includes('google')) {
                if (url.hostname.includes('maps')) {
                    this.context.pageType = 'maps';
                } else if (url.hostname.includes('mail')) {
                    this.context.pageType = 'email';
                } else {
                    this.context.pageType = 'search';
                }
            } else {
                this.context.pageType = 'general';
            }
            
            console.log('📍 Page Context:', this.context);
        } catch (error) {
            console.error('Context analysis error:', error);
        }
    }

    async continueWithIntelligence() {
        // Capture current page state
        const pageState = await this.capturePageState();
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;
        
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
                            text: `CONTINUE TASK WITH CURRENT STATE FEEDBACK

CURRENT PAGE STATE:
- URL: ${pageState.url}
- Title: ${pageState.title}
- Page Type: ${pageState.pageType}
- Visible Elements: ${JSON.stringify(pageState.visibleElements)}
- Last Action: ${JSON.stringify(this.memory.session.taskProgress.slice(-1)[0])}
- Last Action Result: ${this.lastActionResult ? 'SUCCESS' : 'FAILED'}

TASK PROGRESS:
- Original Task: ${this.currentTask}
- Actions Taken: ${this.memory.session.taskProgress.length}
- Current Confidence: ${this.context.confidence}

IMPORTANT: Based on the current state shown in the screenshot and the state information above:
1. Analyze what happened after the last action
2. Determine if we're making progress toward the goal
3. Decide the NEXT SINGLE ACTION to take
4. If the task is complete, respond with: {"complete": true, "message": "success details"}
5. If stuck after 3 failed attempts, try a completely different approach

${this.getUltraSmartPrompt()}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async executePlan(plan) {
        console.log('📝 Executing multi-step plan:', plan.steps.length, 'steps');
        
        for (const step of plan.steps) {
            console.log(`Step ${step.step}: ${step.action}`);
            
            // Execute step
            const success = await this.executeAction(step);
            
            if (success && step.verify) {
                // Verify step completion
                const verified = await this.verifyStep(step.verify);
                if (!verified) {
                    console.log('❌ Verification failed');
                    await this.intelligentRecovery(step);
                    return;
                }
            }
            
            await this.sleep(1000);
        }
    }

    async verifyStep(verification) {
        console.log('✓ Verifying:', verification);
        // Implementation would check if condition is met
        return true;
    }

    handleTaskComplete(response) {
        console.log('🎉 Task Complete!');
        console.log('📊 Final confidence:', this.context.confidence);
        console.log('🧠 Reasoning chain:', this.reasoning.decisions);
        
        this.notify('success', `✅ ${response.message || 'Task completed successfully!'}`);
        
        // Reset for next task
        this.reasoning = { observations: [], hypotheses: [], decisions: [] };
        this.context.confidence = 0;
    }

    async executeAction(action) {
        try {
            // Ensure content script is ready
            const ready = await this.ensureContentScript();
            if (!ready) {
                console.error('Content script not ready for action:', action);
                return false;
            }
            
            // If action has strategies, it's already in the right format
            // Otherwise, wrap it for the content script
            const actionData = action.method ? action : {
                type: action.type,
                selector: action.selector,
                text: action.text,
                url: action.url,
                key: action.key,
                direction: action.direction,
                amount: action.amount,
                clear: action.clear
            };
            
            console.log('Sending action to content script:', actionData);
            
            // Send action with timeout
            const response = await Promise.race([
                chrome.tabs.sendMessage(this.activeTabId, {
                    action: 'EXECUTE_ACTION',
                    data: actionData
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Action timeout')), 5000)
                )
            ]);
            
            console.log('Action response:', response);
            return response && response.success;
        } catch (error) {
            console.error('Action execution error:', error);
            
            // Try to recover by re-injecting content script
            if (error.message.includes('Could not establish connection')) {
                console.log('Connection lost, attempting to re-inject content script...');
                const reinjected = await this.ensureContentScript();
                if (reinjected) {
                    console.log('Re-injection successful, retrying action...');
                    try {
                        const response = await chrome.tabs.sendMessage(this.activeTabId, {
                            action: 'EXECUTE_ACTION',
                            data: action
                        });
                        return response && response.success;
                    } catch (retryError) {
                        console.error('Retry failed:', retryError);
                    }
                }
            }
            
            return false;
        }
    }

    async captureScreenshot() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('devtools://') || tab.url?.startsWith('edge://')) {
                console.log('Cannot capture screenshot of browser pages');
                // Try to find a normal tab
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                for (const t of tabs) {
                    if (t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('devtools://') && !t.url.startsWith('edge://')) {
                        this.activeTabId = t.id;
                        break;
                    }
                }
                const newTab = await chrome.tabs.get(this.activeTabId);
                if (newTab.url?.startsWith('chrome://') || newTab.url?.startsWith('devtools://')) {
                    return null;
                }
            }
            
            // Ensure tab is active
            await chrome.tabs.update(this.activeTabId, { active: true });
            await this.sleep(100);
            
            return await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 90
            });
        } catch (error) {
            console.error('Screenshot error:', error);
            if (error.message?.includes('activeTab')) {
                // Try to activate the tab first
                try {
                    await chrome.tabs.update(this.activeTabId, { active: true });
                    await this.sleep(200);
                    return await chrome.tabs.captureVisibleTab(null, {
                        format: 'jpeg',
                        quality: 90
                    });
                } catch (retryError) {
                    console.error('Screenshot retry failed:', retryError);
                }
            }
            return null;
        }
    }

    async ensureContentScript() {
        try {
            // First check if content script is already loaded
            const response = await chrome.tabs.sendMessage(this.activeTabId, { action: 'PING' }).catch(() => null);
            if (response && response.success) {
                console.log('Content script already loaded');
                return true;
            }
        } catch (error) {
            console.log('Content script not ready, will inject');
        }
        
        try {
            // Check if tab is valid for injection
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('devtools://') || 
                tab.url?.startsWith('edge://') || tab.url?.startsWith('about:')) {
                console.error('Cannot inject script into browser pages');
                this.notify('error', '❌ Cannot control browser pages. Please navigate to a regular website.');
                return false;
            }
            
            console.log('Injecting content script into tab:', this.activeTabId, 'URL:', tab.url);
            
            // Remove any existing content script first
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: this.activeTabId },
                    func: () => {
                        // Remove any existing listener
                        if (window.__ultraSmartController) {
                            window.__ultraSmartController.cleanup();
                            delete window.__ultraSmartController;
                        }
                    }
                });
            } catch (e) {
                // Ignore errors when removing
            }
            
            // Inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: this.activeTabId },
                files: ['ultra-smart-controller.js']
            });
            
            console.log('Content script injected, waiting for initialization...');
            await this.sleep(1000); // Give more time to initialize
            
            // Verify injection worked with retries
            for (let i = 0; i < 3; i++) {
                try {
                    const response = await chrome.tabs.sendMessage(this.activeTabId, { action: 'PING' });
                    if (response && response.success) {
                        console.log('✅ Content script verified and ready');
                        return true;
                    }
                } catch (e) {
                    console.log(`Verification attempt ${i+1} failed, retrying...`);
                    await this.sleep(500);
                }
            }
            
            console.error('Content script verification failed after retries');
            return false;
        } catch (error) {
            console.error('Content script injection failed:', error);
            this.notify('error', '❌ Failed to inject controller. Try refreshing the page.');
            return false;
        }
    }

    loadLearnedPatterns() {
        // Load from storage or return default
        return {};
    }

    saveLearnedPatterns() {
        chrome.storage.local.set({ learnedPatterns: this.memory.learned });
    }

    notify(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message }
        }).catch(() => {});
    }

    stopAutomation() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.isConnected = false;
        this.notify('status', '🛑 Stopped');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getUltraSmartPrompt() {
        return `You are an ULTRA-INTELLIGENT browser automation AI with advanced reasoning capabilities.

CRITICAL RULES:
1. **RETURN ONLY ONE ACTION AT A TIME** - Never return multiple actions or a plan with multiple steps
2. **ALWAYS THINK STEP-BY-STEP** - Use detailed chain-of-thought reasoning before each action
3. **WAIT FOR FEEDBACK** - After each action, wait to see the result before deciding the next step
4. **BE EXPLICIT** - Clearly state what you're doing and why

THINKING MODE - ALWAYS USE THIS STRUCTURE:
{
  "thinking": {
    "current_situation": "Detailed description of what I observe on the page",
    "task_understanding": "What the user wants me to achieve",
    "possible_approaches": ["Option 1: ...", "Option 2: ...", "Option 3: ..."],
    "chosen_approach": "The best approach and why",
    "next_immediate_step": "The ONE action I will take now",
    "expected_outcome": "What should happen after this action",
    "fallback_plan": "What to do if this action fails"
  },
  "reasoning": {
    "observation": "What I see on the page right now",
    "inference": "What this means for the task",
    "decision": "The specific action I'm taking",
    "confidence": 0.9
  },
  "action": {
    "type": "click|type|navigate|wait|scroll|press",
    "selector": "element to interact with",
    "text": "text to type (for type action)",
    "url": "URL to navigate to (for navigate)",
    "key": "key to press (for press action)"
  }
}

CAPABILITIES:
- Visual understanding of page layouts and elements
- Chain-of-thought reasoning for complex tasks
- Learning from successful patterns
- Predictive intelligence for common flows
- Self-correction and validation

VISUAL UNDERSTANDING:
- Identify page regions (navigation, content, forms)
- Understand spatial relationships
- Recognize common UI patterns
- Detect page state (loading, ready, error)

ACTION TYPES:
- navigate: Go to a URL
- click: Click an element
- type: Type text into an input
- scroll: Scroll the page
- wait: Wait for page to load
- press: Press a keyboard key (Enter, Tab, etc.)

IMPORTANT CONSTRAINTS:
- NEVER provide multiple actions in one response
- NEVER skip the thinking process
- ALWAYS explain your reasoning
- ALWAYS wait for the page to update after each action
- ONLY suggest the next action after observing the result of the previous one

REMEMBER:
- One action at a time
- Think thoroughly before acting
- Explain your thinking process
- Wait for feedback
- Learn from patterns
- Be confident but careful`;
    }
}

// Initialize
const automationEngine = new UltraSmartEngine();
automationEngine.initialize().then(() => {
    console.log('✅ Ultra-Smart Engine initialized successfully');
}).catch(error => {
    console.error('❌ Failed to initialize Ultra-Smart Engine:', error);
});