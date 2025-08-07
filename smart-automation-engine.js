// Smart Browser Automation Engine with Enhanced AI Understanding
// Improved navigation strategies and context awareness

class SmartAutomationEngine {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.currentTask = null;
        this.currentUrl = null;
        this.taskHistory = [];
        this.failedActions = [];
        this.messageBuffer = '';
        this.lastSuccessfulAction = null;
        this.actionAttempts = 0;
        this.maxActionAttempts = 3;
    }

    // Initialize
    async initialize() {
        console.log('🚀 Initializing Smart Automation Engine');
        
        try {
            await chrome.sidePanel.setOptions({
                path: 'simple-chat.html',
                enabled: true
            });
            
            await chrome.sidePanel.setPanelBehavior({ 
                openPanelOnActionClick: true 
            });
            console.log('✅ Side panel configured');
        } catch (error) {
            console.error('Side panel setup error:', error);
        }

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
            console.log('✅ API key loaded');
        }
    }

    // Handle messages
    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.action);
        
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

                case 'STOP_AUTOMATION':
                    this.stopAutomation();
                    sendResponse({ success: true });
                    break;

                case 'EXECUTE_TASK':
                    this.currentTask = request.data.task;
                    await this.startNewTask();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // Start automation
    async startAutomation(tabId, initialTask) {
        if (!this.apiKey) {
            this.notify('error', '❌ Please set your API key first');
            return false;
        }

        this.activeTabId = tabId;
        this.currentTask = initialTask;
        this.taskHistory = [];
        this.failedActions = [];
        
        // Get current URL
        try {
            const tab = await chrome.tabs.get(tabId);
            this.currentUrl = tab.url;
            console.log('Current URL:', this.currentUrl);
        } catch (error) {
            console.error('Failed to get tab URL:', error);
        }
        
        console.log('🎯 Starting automation with task:', initialTask);
        this.notify('status', 'Connecting to AI...');
        
        const connected = await this.connectToGemini();
        
        if (!connected) {
            this.notify('error', '❌ Failed to connect');
            return false;
        }

        this.notify('status', '✅ Connected! Ready for tasks');
        
        if (initialTask && initialTask !== 'Ready to help. What would you like me to do?') {
            await this.startNewTask();
        }

        return true;
    }

    // Connect to Gemini
    async connectToGemini() {
        return new Promise((resolve) => {
            try {
                if (this.websocket) {
                    this.websocket.close();
                    this.websocket = null;
                }

                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                
                console.log('🔌 Connecting to Gemini...');
                this.websocket = new WebSocket(wsUrl);
                
                const connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        this.websocket.close();
                        resolve(false);
                    }
                }, 10000);

                this.websocket.onopen = async () => {
                    console.log('✅ WebSocket opened');
                    clearTimeout(connectionTimeout);
                    
                    const setup = {
                        setup: {
                            model: "models/gemini-2.0-flash-exp",
                            generationConfig: {
                                responseModalities: ["TEXT"],
                                temperature: 0.6,
                                topP: 0.9,
                                maxOutputTokens: 2048
                            },
                            systemInstruction: {
                                parts: [{
                                    text: this.getEnhancedSystemPrompt()
                                }]
                            }
                        }
                    };

                    this.websocket.send(JSON.stringify(setup));
                    
                    let setupResolved = false;
                    const setupTimeout = setTimeout(() => {
                        if (!setupResolved) {
                            this.isConnected = true;
                            setupResolved = true;
                            resolve(true);
                        }
                    }, 3000);
                    
                    this.setupCompleteHandler = async (event) => {
                        let data;
                        if (event.data instanceof Blob) {
                            const text = await event.data.text();
                            try {
                                data = JSON.parse(text);
                            } catch (e) {
                                return;
                            }
                        } else {
                            try {
                                data = JSON.parse(event.data);
                            } catch (e) {
                                return;
                            }
                        }
                        
                        if (data && data.setupComplete) {
                            console.log('✅ Setup complete');
                            clearTimeout(setupTimeout);
                            this.isConnected = true;
                            setupResolved = true;
                            this.websocket.removeEventListener('message', this.setupCompleteHandler);
                            resolve(true);
                        }
                    };
                    
                    this.websocket.addEventListener('message', this.setupCompleteHandler);
                };

                this.websocket.onmessage = async (event) => {
                    if (!this.isConnected) return;
                    await this.handleGeminiMessage(event);
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    clearTimeout(connectionTimeout);
                    this.isConnected = false;
                    resolve(false);
                };

                this.websocket.onclose = () => {
                    console.log('🔌 WebSocket closed');
                    this.isConnected = false;
                    this.notify('status', '⚠️ Disconnected');
                };

            } catch (error) {
                console.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    // Handle Gemini messages
    async handleGeminiMessage(event) {
        let data;
        
        if (event.data instanceof Blob) {
            const text = await event.data.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                return;
            }
        } else {
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                return;
            }
        }

        if (data.serverContent) {
            if (data.serverContent.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.text) {
                        this.messageBuffer += part.text;
                    }
                }
            }

            if (data.serverContent.turnComplete) {
                console.log('📝 Complete response received');
                if (this.messageBuffer.length > 0) {
                    await this.processAIResponse(this.messageBuffer);
                    this.messageBuffer = '';
                }
            }
        }
    }

    // Process AI response
    async processAIResponse(responseText) {
        try {
            console.log('🤖 AI Response:', responseText);
            
            // Clean and extract JSON
            let cleanedText = responseText;
            if (responseText.includes('```json')) {
                cleanedText = responseText.replace(/```json\s*/g, '').replace(/```/g, '');
            } else if (responseText.includes('```')) {
                cleanedText = responseText.replace(/```\s*/g, '');
            }
            
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                this.notify('message', `AI: ${responseText}`);
                return;
            }

            let response;
            try {
                response = JSON.parse(jsonMatch[0]);
            } catch (e) {
                // Try to fix JSON
                let fixedJson = jsonMatch[0]
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']')
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
                    .replace(/:\s*'([^']*)'/g, ': "$1"');
                
                try {
                    response = JSON.parse(fixedJson);
                } catch (e2) {
                    console.error('Cannot parse JSON:', e2);
                    this.notify('error', '❌ Invalid response format');
                    return;
                }
            }

            // Process response based on type
            if (response.thought) {
                this.notify('message', `🤔 ${response.thought}`);
            }

            if (response.action) {
                await this.executeSmartAction(response.action);
            } else if (response.complete || response.task_complete) {
                this.handleTaskComplete(response.message || 'Task completed!');
            } else if (response.error) {
                this.notify('error', `❌ ${response.error}`);
                await this.askForAlternative();
            }

        } catch (error) {
            console.error('Error processing response:', error);
            this.notify('error', '❌ Failed to process AI response');
        }
    }

    // Execute action with smart strategies
    async executeSmartAction(action) {
        console.log('🎬 Executing smart action:', action);
        
        // Pre-process action for better success
        const processedAction = await this.preprocessAction(action);
        
        // Execute the action
        const success = await this.executeAction(processedAction);
        
        if (success) {
            this.notify('action', `✅ ${processedAction.type}: ${processedAction.selector || processedAction.url || ''}`);
            this.lastSuccessfulAction = processedAction;
            this.actionAttempts = 0;
            
            // Wait for action to complete
            await this.sleep(processedAction.wait || 1500);
            
            // Continue with next step
            await this.continueTask();
        } else {
            this.actionAttempts++;
            this.failedActions.push(processedAction);
            
            if (this.actionAttempts < this.maxActionAttempts) {
                this.notify('error', `❌ Attempt ${this.actionAttempts} failed: ${processedAction.type}`);
                await this.askForAlternative();
            } else {
                this.notify('error', `❌ Action failed after ${this.maxActionAttempts} attempts`);
                this.actionAttempts = 0;
                await this.askForNewApproach();
            }
        }
    }

    // Preprocess action for better success
    async preprocessAction(action) {
        const processed = { ...action };
        
        // Smart navigation handling
        if (action.type === 'navigate') {
            // Add protocol if missing
            if (action.url && !action.url.startsWith('http')) {
                processed.url = 'https://' + action.url;
            }
            
            // Add longer wait for navigation
            processed.wait = action.wait || 3000;
        }
        
        // Smart selector handling
        if (action.selector && action.type !== 'navigate') {
            // Try multiple selector strategies
            processed.selectors = [
                action.selector,
                `[aria-label*="${action.selector}"]`,
                `[placeholder*="${action.selector}"]`,
                `[title*="${action.selector}"]`,
                `button:contains("${action.selector}")`,
                `a:contains("${action.selector}")`
            ];
        }
        
        // Add context from current page
        if (this.currentUrl) {
            processed.context = {
                url: this.currentUrl,
                lastAction: this.lastSuccessfulAction
            };
        }
        
        return processed;
    }

    // Execute action
    async executeAction(action) {
        try {
            await this.ensureContentScript();
            
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'EXECUTE_ACTION',
                data: action
            });
            
            // Update current URL if navigation succeeded
            if (action.type === 'navigate' && response.success) {
                this.currentUrl = action.url;
            }
            
            return response.success;
        } catch (error) {
            console.error('Action execution error:', error);
            
            if (error.message && error.message.includes('Could not establish connection')) {
                await this.injectContentScript();
                await this.sleep(500);
                
                try {
                    const response = await chrome.tabs.sendMessage(this.activeTabId, {
                        action: 'EXECUTE_ACTION',
                        data: action
                    });
                    return response.success;
                } catch (retryError) {
                    return false;
                }
            }
            
            return false;
        }
    }

    // Continue task with context
    async continueTask() {
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;

        const context = {
            task: this.currentTask,
            url: this.currentUrl,
            lastAction: this.lastSuccessfulAction,
            history: this.taskHistory.slice(-3) // Last 3 actions
        };

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
                            text: `Task: ${this.currentTask}
Current URL: ${this.currentUrl || 'unknown'}
Last successful action: ${this.lastSuccessfulAction ? JSON.stringify(this.lastSuccessfulAction) : 'none'}

Looking at the current screen, what is the NEXT SINGLE action to continue this task?
If the task is complete, respond with {"complete": true, "message": "success message"}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Ask for alternative approach
    async askForAlternative() {
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
                            text: `The last action failed. Task: ${this.currentTask}
Failed action: ${JSON.stringify(this.failedActions[this.failedActions.length - 1])}

What alternative action should we try? Consider:
1. Different selector strategies
2. Waiting for elements to load
3. Using navigation if element interaction fails
4. Trying different UI paths to achieve the same goal`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Ask for completely new approach
    async askForNewApproach() {
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
                            text: `Multiple attempts have failed. Task: ${this.currentTask}

Let's try a completely different approach. Consider:
1. Navigating directly to the target URL
2. Using browser search (Ctrl+F) to find elements
3. Using the site's search feature
4. Going through menus or navigation bars

What new approach should we try?`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Start new task
    async startNewTask() {
        if (!this.currentTask || !this.isConnected) return;
        
        console.log('📋 Starting new task:', this.currentTask);
        this.taskHistory = [];
        this.failedActions = [];
        this.actionAttempts = 0;
        
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            this.notify('error', '❌ Failed to capture screenshot');
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
                            text: `Task: ${this.currentTask}
Current URL: ${this.currentUrl || 'unknown'}

Analyze the current screen and provide the FIRST action to start this task.
If we need to navigate to a different website first, start with navigation.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Handle task completion
    handleTaskComplete(message) {
        console.log('🎉 Task completed!');
        this.currentTask = null;
        this.taskHistory = [];
        this.failedActions = [];
        this.notify('success', `✅ ${message}`);
    }

    // Capture screenshot
    async captureScreenshot() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('devtools://'))) {
                const tabs = await chrome.tabs.query({ windowId: tab.windowId });
                for (const t of tabs) {
                    if (t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('devtools://')) {
                        this.activeTabId = t.id;
                        await chrome.tabs.update(t.id, { active: true });
                        await this.sleep(300);
                        break;
                    }
                }
            }
            
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 85
            });
            return dataUrl;
        } catch (error) {
            console.error('Screenshot error:', error);
            return null;
        }
    }

    // Ensure content script
    async ensureContentScript() {
        try {
            const response = await chrome.tabs.sendMessage(this.activeTabId, { 
                action: 'PING' 
            });
            
            if (response && response.success) {
                return true;
            }
        } catch (error) {
            return await this.injectContentScript();
        }
    }

    // Inject content script
    async injectContentScript() {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: this.activeTabId },
                files: ['smart-browser-controller.js']
            });
            await this.sleep(500);
            return true;
        } catch (error) {
            console.error('Injection error:', error);
            return false;
        }
    }

    // Send notification
    notify(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message }
        }).catch(() => {});
    }

    // Stop automation
    stopAutomation() {
        console.log('🛑 Stopping automation');
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnected = false;
        this.currentTask = null;
        this.taskHistory = [];
        this.failedActions = [];
        this.notify('status', '🛑 Automation stopped');
    }

    // Utility: sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get enhanced system prompt
    getEnhancedSystemPrompt() {
        return `You are an expert browser automation assistant with deep understanding of web navigation and UI interaction.

RESPOND WITH ONLY VALID JSON.

Response format:
{
  "thought": "Clear explanation of what I'm doing and why",
  "action": {
    "type": "navigate|click|type|wait|scroll|press",
    "url": "https://example.com (for navigate)",
    "selector": "element identifier (for click/type)",
    "text": "text to type (for type)",
    "wait": 2000 (milliseconds to wait)
  }
}

Or when task is complete:
{
  "complete": true,
  "message": "Task successfully completed"
}

ACTION TYPES:
1. navigate - Go to a URL
   Example: {"type": "navigate", "url": "https://maps.google.com", "wait": 3000}

2. click - Click an element
   Example: {"type": "click", "selector": "Search"}
   Example: {"type": "click", "selector": "Get directions"}

3. type - Type text in an input
   Example: {"type": "type", "selector": "Search", "text": "Manali"}
   Example: {"type": "type", "selector": "Choose starting point", "text": "Delhi"}

4. wait - Wait for page/elements to load
   Example: {"type": "wait", "wait": 2000}

5. scroll - Scroll the page
   Example: {"type": "scroll", "direction": "down", "amount": 500}

6. press - Press a key
   Example: {"type": "press", "key": "Enter"}

SELECTOR STRATEGIES (in order of preference):
1. Visible text on buttons/links: "Search", "Sign in", "Get directions"
2. Placeholder text in inputs: "Search Google Maps", "Enter location"
3. Aria-labels: "Search button", "Menu"
4. Common patterns: For search boxes use "Search" or "search"

NAVIGATION INTELLIGENCE:
- For Google Maps: maps.google.com
- For Gmail: mail.google.com
- For YouTube: youtube.com
- For Google Search: google.com
- Always use HTTPS protocol

IMPORTANT RULES:
1. ALWAYS start with navigation if the task requires a specific website
2. ONE action at a time - be methodical
3. Add appropriate wait times: 3000ms after navigation, 1000ms after clicks
4. If an element is not visible, try scrolling first
5. Consider the current page context when choosing actions
6. If repeated failures occur, try navigation to reset

COMMON PATTERNS:
- Google Maps: Navigate → Click "Directions" → Type origin → Type destination → Click "Search"
- Search: Click search box → Type query → Press Enter or click search button
- Forms: Click field → Type text → Tab to next field or click next field

Remember: Be smart about navigation. If you're already on the right page, don't navigate again. If interactions fail repeatedly, consider navigating to reset the page state.`;
    }
}

// Initialize the engine
const automationEngine = new SmartAutomationEngine();
automationEngine.initialize();