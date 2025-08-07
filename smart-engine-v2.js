// Smart Browser Automation Engine V2 - Simplified and Improved
// Better connection handling, clearer prompts, more reliable execution

class SmartEngineV2 {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.currentTask = null;
        this.actionHistory = [];
        this.messageBuffer = '';
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async initialize() {
        console.log('🚀 Initializing Smart Engine V2');
        
        try {
            // Setup side panel
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

        // Listen for messages
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Load API key
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
            console.log('API key loaded');
        }
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.action);
        
        try {
            switch (request.action) {
                case 'SET_API_KEY':
                    this.apiKey = request.data.apiKey;
                    console.log('Setting API key:', this.apiKey.substring(0, 10) + '...');
                    await chrome.storage.local.set({ geminiApiKey: this.apiKey });
                    this.sendNotification('message', '✅ API key saved');
                    sendResponse({ success: true });
                    break;

                case 'START_AUTOMATION':
                    const result = await this.startAutomation(request.data.tabId, request.data.task);
                    sendResponse({ success: result });
                    break;

                case 'EXECUTE_TASK':
                    if (!this.isConnected) {
                        console.log('Not connected, attempting to connect...');
                        const connected = await this.connectToGemini();
                        if (!connected) {
                            sendResponse({ success: false, error: 'Connection failed' });
                            return;
                        }
                    }
                    await this.executeTask(request.data.task);
                    sendResponse({ success: true });
                    break;

                case 'STOP_AUTOMATION':
                    this.stopAutomation();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startAutomation(tabId, task) {
        console.log('Starting automation for tab:', tabId);
        this.activeTabId = tabId;
        this.actionHistory = [];
        this.retryCount = 0;
        
        // Check API key first
        if (!this.apiKey) {
            console.error('No API key set');
            this.sendNotification('error', '❌ Please enter your API key first');
            this.sendNotification('status', 'API key required');
            return false;
        }
        
        // Connect to Gemini
        this.sendNotification('status', 'Connecting to AI...');
        console.log('Attempting to connect with API key:', this.apiKey.substring(0, 10) + '...');
        
        const connected = await this.connectToGemini();
        
        if (!connected) {
            console.error('Connection failed');
            this.sendNotification('error', '❌ Connection failed. Please check your API key.');
            this.sendNotification('status', 'Connection failed');
            return false;
        }

        console.log('✅ Connection successful');
        this.sendNotification('status', '✅ Connected to AI');
        this.sendNotification('message', '✅ Connected! Ready to help.');
        
        // Execute initial task if provided
        if (task && task !== 'Ready to help. What would you like me to do?') {
            await this.executeTask(task);
        }

        return true;
    }

    async connectToGemini() {
        if (!this.apiKey) {
            console.error('No API key available');
            return false;
        }

        return new Promise((resolve) => {
            try {
                console.log('Connecting to Gemini...');
                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                
                this.websocket = new WebSocket(wsUrl);
                
                // Set timeout for connection
                const connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        console.error('Connection timeout');
                        this.websocket.close();
                        resolve(false);
                    }
                }, 15000); // 15 seconds timeout

                this.websocket.onopen = () => {
                    console.log('✅ WebSocket opened successfully');
                    this.sendNotification('status', 'WebSocket connected, configuring AI...');
                    
                    const setup = {
                        setup: {
                            model: "models/gemini-2.0-flash-exp",
                            generationConfig: {
                                responseModalities: ["TEXT"],
                                temperature: 0.3,
                                topP: 0.95,
                                maxOutputTokens: 2048
                            },
                            systemInstruction: {
                                parts: [{
                                    text: this.getSystemPrompt()
                                }]
                            }
                        }
                    };

                    console.log('Sending setup configuration...');
                    this.websocket.send(JSON.stringify(setup));
                    console.log('Setup sent, waiting for confirmation...');
                };

                this.websocket.onmessage = async (event) => {
                    try {
                        let data;
                        if (event.data instanceof Blob) {
                            const text = await event.data.text();
                            data = JSON.parse(text);
                        } else {
                            data = JSON.parse(event.data);
                        }

                        // Log all messages for debugging
                        console.log('WebSocket message received:', data);
                        
                        // Check for setup completion
                        if (data.setupComplete) {
                            console.log('✅ Setup complete confirmed by server!');
                            clearTimeout(connectionTimeout);
                            this.isConnected = true;
                            this.sendNotification('status', '✅ AI Connected');
                            this.sendNotification('message', '🎉 Successfully connected to Gemini AI!');
                            resolve(true);
                            return;
                        }
                        
                        // Check for errors
                        if (data.error) {
                            console.error('Server error:', data.error);
                            this.sendNotification('error', `❌ Server error: ${data.error.message || data.error}`);
                        }

                        // Handle regular messages
                        if (this.isConnected && data.serverContent) {
                            await this.handleGeminiResponse(data);
                        }
                    } catch (error) {
                        console.error('Message handling error:', error);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    clearTimeout(connectionTimeout);
                    this.isConnected = false;
                    this.sendNotification('error', '❌ WebSocket connection error');
                    this.sendNotification('status', 'Connection error');
                    resolve(false);
                };

                this.websocket.onclose = (event) => {
                    console.log('WebSocket closed, code:', event.code, 'reason:', event.reason);
                    clearTimeout(connectionTimeout);
                    
                    if (!this.isConnected) {
                        // Connection failed during setup
                        console.error('Connection closed before setup complete');
                        this.sendNotification('error', '❌ Connection closed unexpectedly');
                        this.sendNotification('status', 'Failed to connect');
                    } else {
                        // Normal disconnection
                        this.isConnected = false;
                        this.sendNotification('status', '⚠️ Disconnected');
                    }
                };

            } catch (error) {
                console.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    async handleGeminiResponse(data) {
        // Accumulate message parts
        if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
                if (part.text) {
                    this.messageBuffer += part.text;
                }
            }
        }

        // Process complete message
        if (data.serverContent?.turnComplete) {
            console.log('Complete response received');
            if (this.messageBuffer) {
                await this.processResponse(this.messageBuffer);
                this.messageBuffer = '';
            }
        }
    }

    async processResponse(responseText) {
        console.log('Processing response:', responseText.substring(0, 200) + '...');
        
        try {
            // Extract JSON from response
            let jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.log('No JSON found in response');
                this.sendNotification('message', responseText);
                return;
            }

            const response = JSON.parse(jsonMatch[0]);
            console.log('Parsed response:', response);

            // Show thinking process
            if (response.thinking) {
                console.log('🤔 Thinking:', response.thinking);
                this.sendNotification('message', `🤔 ${response.thinking}`);
            }

            // Execute action
            if (response.action) {
                await this.executeAction(response.action);
            }

            // Check if task is complete
            if (response.complete) {
                this.sendNotification('success', `✅ ${response.message || 'Task completed!'}`);
                this.actionHistory = [];
                this.retryCount = 0;
            }

        } catch (error) {
            console.error('Error processing response:', error);
            this.sendNotification('error', '❌ Failed to understand AI response');
        }
    }

    async executeAction(action) {
        console.log('Executing action:', action);
        
        try {
            // Handle tab-related actions
            if (action.type === 'switch_tab') {
                await this.switchTab(action);
                return;
            } else if (action.type === 'new_tab') {
                await this.createNewTab(action);
                return;
            } else if (action.type === 'close_tab') {
                await this.closeTab(action);
                return;
            }
            
            // Ensure content script is injected
            await this.ensureContentScript();
            
            // Send action to content script
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'EXECUTE_ACTION',
                data: action
            });

            if (response.success) {
                this.sendNotification('action', `✅ ${action.type}: ${action.selector || action.url || ''}`);
                this.actionHistory.push({ ...action, success: true });
                this.retryCount = 0;
                
                // Wait for page to update
                await this.sleep(1500);
                
                // Continue with next step
                await this.continueTask();
            } else {
                this.sendNotification('error', `❌ Failed: ${response.error}`);
                this.actionHistory.push({ ...action, success: false, error: response.error });
                this.retryCount++;
                
                // Try recovery
                if (this.retryCount < this.maxRetries) {
                    await this.recoverFromFailure(action, response.error);
                } else {
                    this.sendNotification('error', '❌ Max retries reached. Please try a different approach.');
                    this.retryCount = 0;
                }
            }
        } catch (error) {
            console.error('Action execution error:', error);
            this.sendNotification('error', `❌ Error: ${error.message}`);
        }
    }
    
    async switchTab(action) {
        console.log('Switching tab:', action);
        
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            let targetTab = null;
            
            if (action.index !== undefined) {
                targetTab = tabs[action.index];
            } else if (action.title) {
                targetTab = tabs.find(tab => 
                    tab.title.toLowerCase().includes(action.title.toLowerCase())
                );
            } else if (action.url) {
                targetTab = tabs.find(tab => 
                    tab.url.includes(action.url)
                );
            } else if (action.direction === 'next') {
                const currentIndex = tabs.findIndex(tab => tab.id === this.activeTabId);
                targetTab = tabs[(currentIndex + 1) % tabs.length];
            } else if (action.direction === 'previous') {
                const currentIndex = tabs.findIndex(tab => tab.id === this.activeTabId);
                targetTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
            }
            
            if (targetTab) {
                await chrome.tabs.update(targetTab.id, { active: true });
                this.activeTabId = targetTab.id;
                await this.sleep(500);
                await this.ensureContentScript();
                
                this.sendNotification('success', `Switched to: ${targetTab.title}`);
                await this.continueTask();
            } else {
                this.sendNotification('error', 'Tab not found');
            }
        } catch (error) {
            console.error('Failed to switch tab:', error);
            this.sendNotification('error', error.message);
        }
    }
    
    async createNewTab(action) {
        console.log('Creating new tab:', action);
        
        try {
            const tab = await chrome.tabs.create({
                url: action.url || 'about:blank',
                active: true
            });
            
            this.activeTabId = tab.id;
            await this.sleep(2000);
            await this.ensureContentScript();
            
            this.sendNotification('success', `New tab: ${tab.url}`);
            await this.continueTask();
        } catch (error) {
            console.error('Failed to create tab:', error);
            this.sendNotification('error', error.message);
        }
    }
    
    async closeTab(action) {
        console.log('Closing tab:', action);
        
        try {
            const tabId = action.tabId || this.activeTabId;
            const tabs = await chrome.tabs.query({ currentWindow: true });
            
            if (tabs.length <= 1) {
                this.sendNotification('error', 'Cannot close last tab');
                return;
            }
            
            await chrome.tabs.remove(tabId);
            
            const remainingTabs = await chrome.tabs.query({ currentWindow: true, active: true });
            if (remainingTabs.length > 0) {
                this.activeTabId = remainingTabs[0].id;
                await this.ensureContentScript();
            }
            
            this.sendNotification('success', 'Tab closed');
            await this.continueTask();
        } catch (error) {
            console.error('Failed to close tab:', error);
            this.sendNotification('error', error.message);
        }
    }

    async executeTask(task) {
        console.log('Executing task:', task);
        this.currentTask = task;
        this.sendNotification('status', '🧠 Analyzing task...');
        
        // Get screenshot
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            this.sendNotification('error', '❌ Cannot capture screenshot');
            return;
        }

        // Get page info
        const pageInfo = await this.getPageInfo();
        
        // Send to AI
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
                            text: `Task: ${task}

Current page: ${pageInfo.url}
Page title: ${pageInfo.title}

Instructions:
1. Look at the screenshot carefully
2. Think step by step about how to complete the task
3. Return ONE action at a time
4. Wait for feedback before suggesting the next action

Respond in this format:
{
  "thinking": "Brief explanation of what you see and what you're going to do",
  "action": {
    "type": "click|type|navigate|scroll|wait",
    "selector": "CSS selector or element description",
    "text": "text to type (for type action)",
    "url": "URL (for navigate action)"
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

    async continueTask() {
        console.log('Continuing task...');
        
        const screenshot = await this.captureScreenshot();
        if (!screenshot) return;
        
        const pageInfo = await this.getPageInfo();
        
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
                            text: `Continue with the task.

Original task: ${this.currentTask}
Current page: ${pageInfo.url}
Last action: ${JSON.stringify(this.actionHistory[this.actionHistory.length - 1])}

Look at the screenshot and determine the next action.
If the task is complete, respond with: {"complete": true, "message": "Task completed"}

Otherwise, provide the next action in the same format as before.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async recoverFromFailure(failedAction, error) {
        console.log('Attempting recovery from failure');
        
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
                            text: `The last action failed.

Failed action: ${JSON.stringify(failedAction)}
Error: ${error}
Retry attempt: ${this.retryCount} of ${this.maxRetries}

Please try a different approach to achieve the same goal.
Look at the screenshot and suggest an alternative action.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    async ensureContentScript() {
        try {
            // Try to ping content script
            const response = await chrome.tabs.sendMessage(this.activeTabId, { action: 'PING' });
            if (response?.controller === 'coordinate') {
                console.log('Coordinate controller already active');
                return true;
            }
            throw new Error('Need coordinate controller');
        } catch (error) {
            // Inject coordinate-based controller
            console.log('Injecting coordinate controller...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: this.activeTabId },
                    files: ['coordinate-controller.js']
                });
                await this.sleep(500);
                this.sendNotification('message', '🎯 Coordinate controller activated');
                return true;
            } catch (err) {
                console.error('Failed to inject coordinate controller:', err);
                return false;
            }
        }
    }

    async captureScreenshot() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            
            // Check if tab is valid
            if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('devtools://')) {
                console.error('Cannot capture screenshot of browser pages');
                return null;
            }
            
            return await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 85
            });
        } catch (error) {
            console.error('Screenshot error:', error);
            return null;
        }
    }

    async getPageInfo() {
        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            return {
                url: tab.url,
                title: tab.title
            };
        } catch (error) {
            return { url: 'unknown', title: 'unknown' };
        }
    }

    getSystemPrompt() {
        return `You are a browser automation assistant with COORDINATE-BASED clicking and typing simulation.

CAPABILITIES:
- Coordinate-based mouse movement and clicking (not DOM manipulation)
- Real keyboard simulation for typing
- Tab switching and management
- Visual cursor shows exactly where you're clicking
- Can find elements by text content, not just CSS selectors

ACTION TYPES:
1. navigate: Go to a URL
2. click: Click at element (can use text content as selector)
3. type: Type text (smart field detection)
4. fill_form: Fill entire form with data
5. analyze_form: Analyze form fields on page
6. press_enter: Press Enter key
7. scroll: Scroll page up/down
8. wait: Wait for specified duration
9. switch_tab: Switch between tabs
10. new_tab: Create new tab
11. close_tab: Close current or specified tab

TAB ACTIONS:
- {"action": {"type": "switch_tab", "direction": "next"}} - Next tab
- {"action": {"type": "switch_tab", "direction": "previous"}} - Previous tab
- {"action": {"type": "switch_tab", "title": "Amazon"}} - Tab with title
- {"action": {"type": "switch_tab", "index": 0}} - Tab by index
- {"action": {"type": "new_tab", "url": "https://..."}} - Create new tab

FORM FILLING:
- Smart field detection: Automatically identifies email, password, name, phone fields
- {"action": {"type": "type", "fieldType": "email", "text": "user@example.com"}}
- {"action": {"type": "type", "fieldType": "password", "text": "mypassword"}}
- {"action": {"type": "fill_form", "data": {"email": "user@example.com", "password": "pass123", "fullName": "John Doe"}}}
- {"action": {"type": "analyze_form"}} - Returns form field analysis

EXAMPLES:
- Navigate: {"action": {"type": "navigate", "url": "https://www.amazon.in"}}
- Click by text: {"action": {"type": "click", "selector": "Sign in"}}
- Smart type: {"action": {"type": "type", "fieldType": "email", "text": "user@example.com"}}
- Fill form: {"action": {"type": "fill_form", "data": {"email": "test@test.com", "password": "pass123"}}}
- Type in search: {"action": {"type": "type", "selector": "search", "text": "laptop"}}
- Press Enter: {"action": {"type": "press_enter"}}
- Switch tabs: {"action": {"type": "switch_tab", "direction": "next"}}

RULES:
1. ONE action at a time
2. For search fields, typing automatically presses Enter
3. Click to focus input before typing
4. Use text content for finding elements when possible
5. Wait for page loads when needed

Always respond in JSON format with:
- "thinking": Your analysis
- "action": The specific action
- "complete": true when done`;
    }

    sendNotification(type, message) {
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
        this.sendNotification('status', '🛑 Stopped');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
const smartEngine = new SmartEngineV2();
smartEngine.initialize().then(() => {
    console.log('✅ Smart Engine V2 initialized');
}).catch(error => {
    console.error('❌ Initialization failed:', error);
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Open the side panel
        await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (error) {
        console.error('Failed to open side panel:', error);
        // Fallback: open as popup if side panel fails
        chrome.action.setPopup({ popup: 'popup.html' });
    }
});
