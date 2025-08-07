// Robust Browser Automation Engine v2
// Enhanced with retry logic, better error handling, and connection stability

class RobustAutomationEngine {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.messageBuffer = '';
        this.connectionAttempts = 0;
        this.maxRetries = 3;
        this.actionRetries = 2;
        this.healthCheckInterval = null;
        this.reconnectTimeout = null;
        this.lastSuccessfulAction = null;
        this.pendingTask = null;
    }

    // Initialize with better error handling
    async initialize() {
        console.log('🚀 Initializing Robust Automation Engine v2');
        console.log('Chrome version:', navigator.userAgent);
        
        try {
            // Set up side panel
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

        // Start health monitoring
        this.startHealthMonitoring();
    }

    // Enhanced message handler
    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.action);
        
        try {
            switch (request.action) {
                case 'SET_API_KEY':
                    console.log('Setting API key...');
                    this.apiKey = request.data.apiKey;
                    await chrome.storage.local.set({ geminiApiKey: this.apiKey });
                    console.log('API key saved, length:', this.apiKey.length);
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
                    this.pendingTask = request.data.task;
                    await this.executePendingTask();
                    sendResponse({ success: true });
                    break;

                case 'GET_STATUS':
                    sendResponse({ 
                        connected: this.isConnected,
                        apiKey: !!this.apiKey 
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // Start automation with better connection handling
    async startAutomation(tabId, initialTask) {
        console.log('🎯 Starting automation with tabId:', tabId);
        console.log('API Key present:', !!this.apiKey);
        
        if (!this.apiKey) {
            this.notify('error', '❌ Please set your API key first');
            return false;
        }

        this.activeTabId = tabId;
        this.pendingTask = initialTask;
        this.connectionAttempts = 0;
        
        console.log('🎯 Starting automation with task:', initialTask);
        this.notify('status', 'Connecting to AI...');
        
        // Try to connect with retries
        const connected = await this.connectWithRetries();
        
        if (!connected) {
            this.notify('error', '❌ Failed to connect after multiple attempts');
            return false;
        }

        this.notify('status', '✅ Connected! Ready for tasks');
        
        // Execute initial task if provided
        if (initialTask && initialTask !== 'Ready to help. What would you like me to do?') {
            await this.executePendingTask();
        }

        return true;
    }

    // Connect with automatic retries
    async connectWithRetries() {
        while (this.connectionAttempts < this.maxRetries) {
            this.connectionAttempts++;
            console.log(`🔄 Connection attempt ${this.connectionAttempts}/${this.maxRetries}`);
            
            try {
                const connected = await this.connectToGemini();
                if (connected) {
                    this.connectionAttempts = 0;
                    return true;
                }
            } catch (error) {
                console.error(`Connection attempt ${this.connectionAttempts} failed:`, error);
            }
            
            if (this.connectionAttempts < this.maxRetries) {
                const delay = this.connectionAttempts * 2000; // Exponential backoff
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await this.sleep(delay);
            }
        }
        
        return false;
    }

    // Enhanced Gemini connection
    async connectToGemini() {
        return new Promise((resolve) => {
            try {
                // Close existing connection if any
                if (this.websocket) {
                    this.websocket.close();
                    this.websocket = null;
                }

                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                
                console.log('🔌 Connecting to Gemini...');
                console.log('WebSocket URL:', wsUrl.replace(this.apiKey, 'API_KEY_HIDDEN'));
                this.websocket = new WebSocket(wsUrl);
                
                // Set timeout for connection
                const connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        console.log('⏱️ Connection timeout');
                        this.websocket.close();
                        resolve(false);
                    }
                }, 10000);

                this.websocket.onopen = async () => {
                    console.log('✅ WebSocket opened');
                    clearTimeout(connectionTimeout);
                    
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
                                    text: this.getSystemPrompt()
                                }]
                            }
                        }
                    };

                    console.log('📤 Sending setup message...');
                    this.websocket.send(JSON.stringify(setup));
                    
                    // Wait for setup complete with timeout
                    let setupResolved = false;
                    const setupTimeout = setTimeout(() => {
                        if (!setupResolved) {
                            console.log('⏱️ Setup timeout - but continuing anyway');
                            this.isConnected = true;
                            setupResolved = true;
                            resolve(true);
                        }
                    }, 3000);
                    
                    this.setupCompleteHandler = async (event) => {
                        console.log('📥 Received message during setup, type:', typeof event.data);
                        
                        let data;
                        // Handle binary/blob data
                        if (event.data instanceof Blob) {
                            console.log('Converting Blob to text...');
                            const text = await event.data.text();
                            console.log('Blob text:', text);
                            try {
                                data = JSON.parse(text);
                            } catch (e) {
                                console.error('Failed to parse blob text:', e);
                                return;
                            }
                        } else {
                            data = this.parseMessage(event);
                        }
                        
                        if (data) {
                            console.log('📋 Parsed data:', data);
                            if (data.setupComplete) {
                                console.log('✅ Setup complete confirmed');
                                clearTimeout(setupTimeout);
                                this.isConnected = true;
                                setupResolved = true;
                                this.websocket.removeEventListener('message', this.setupCompleteHandler);
                                resolve(true);
                            }
                        }
                    };
                    
                    this.websocket.addEventListener('message', this.setupCompleteHandler);
                };

                this.websocket.onmessage = (event) => {
                    if (!this.isConnected) return;
                    this.handleGeminiMessage(event);
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    console.error('Error type:', error.type);
                    console.error('Error target:', error.target);
                    if (error.target) {
                        console.error('Ready state:', error.target.readyState);
                        console.error('URL:', error.target.url);
                    }
                    clearTimeout(connectionTimeout);
                    this.isConnected = false;
                    resolve(false);
                };

                this.websocket.onclose = () => {
                    console.log('🔌 WebSocket closed');
                    this.isConnected = false;
                    this.notify('status', '⚠️ Disconnected');
                    
                    // Try to reconnect if we were connected
                    if (this.activeTabId) {
                        this.scheduleReconnect();
                    }
                };

            } catch (error) {
                console.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    // Parse WebSocket messages properly
    parseMessage(event) {
        try {
            // Handle different data types
            if (event.data instanceof Blob) {
                console.log('Received Blob data - converting to text');
                // For binary messages, we need to read as text
                event.data.text().then(text => {
                    console.log('Blob converted to text:', text);
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        console.error('Failed to parse blob text:', e);
                    }
                });
                return null;
            } else if (typeof event.data === 'string') {
                return JSON.parse(event.data);
            } else {
                console.log('Unknown data type:', typeof event.data);
                return null;
            }
        } catch (error) {
            console.error('Parse error:', error);
            console.error('Raw data:', event.data);
            return null;
        }
    }

    // Enhanced message handler
    async handleGeminiMessage(event) {
        let data;
        
        // Handle binary/blob data
        if (event.data instanceof Blob) {
            const text = await event.data.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse blob in message handler:', e);
                return;
            }
        } else {
            data = this.parseMessage(event);
        }
        
        if (!data) return;

        // Handle server content
        if (data.serverContent) {
            // Accumulate response
            if (data.serverContent.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.text) {
                        this.messageBuffer += part.text;
                    }
                }
            }

            // Process complete response
            if (data.serverContent.turnComplete) {
                console.log('📝 Complete response received');
                await this.processAIResponse(this.messageBuffer);
                this.messageBuffer = '';
            }
        }
    }

    // Process AI response with better error handling
    async processAIResponse(responseText) {
        try {
            console.log('🤖 AI Response:', responseText);
            
            // Try to extract JSON
            let response;
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                try {
                    response = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    // Try to fix common JSON issues
                    let fixedJson = jsonMatch[0]
                        .replace(/,\s*}/, '}')  // Remove trailing commas
                        .replace(/,\s*]/, ']')  // Remove trailing commas in arrays
                        .replace(/'/g, '"');    // Replace single quotes with double
                    
                    response = JSON.parse(fixedJson);
                }
            } else {
                // No JSON found, treat as message
                this.notify('message', `AI: ${responseText}`);
                return;
            }

            // Show AI's thought
            if (response.thought) {
                this.notify('message', `🤔 ${response.thought}`);
            }

            // Execute actions with retry
            if (response.actions && response.actions.length > 0) {
                console.log(`⚡ Executing ${response.actions.length} actions`);
                
                for (const action of response.actions) {
                    const success = await this.executeActionWithRetry(action);
                    
                    if (!success) {
                        this.notify('error', `❌ Failed: ${action.action}`);
                        // Continue with next action anyway
                    }
                    
                    await this.sleep(300); // Small delay between actions
                }
            }

            // Handle completion or next step
            if (response.complete) {
                this.notify('success', '✅ Task completed successfully!');
                this.pendingTask = null;
            } else if (response.nextStep) {
                this.notify('status', `➡️ ${response.nextStep}`);
                
                // Auto-continue after a delay
                setTimeout(() => {
                    if (this.isConnected) {
                        this.continueTask();
                    }
                }, 1500);
            }

        } catch (error) {
            console.error('Error processing response:', error);
            this.notify('error', '❌ Failed to understand AI response');
            
            // Ask AI to retry with proper format
            if (this.isConnected) {
                this.sendToAI('Please respond with the JSON format as specified');
            }
        }
    }

    // Execute action with retry logic
    async executeActionWithRetry(action) {
        let attempts = 0;
        
        while (attempts < this.actionRetries) {
            attempts++;
            console.log(`🎬 Action attempt ${attempts}/${this.actionRetries}:`, action);
            
            try {
                // Ensure content script is ready
                const scriptReady = await this.ensureContentScript();
                if (!scriptReady && attempts === 1) {
                    await this.sleep(1000);
                    continue;
                }

                // Send action to content script
                const response = await chrome.tabs.sendMessage(this.activeTabId, {
                    action: 'EXECUTE_ACTION',
                    data: action
                });

                if (response.success) {
                    console.log('✅ Action succeeded');
                    this.notify('action', `✅ ${action.action}: ${action.selector || ''}`);
                    this.lastSuccessfulAction = action;
                    
                    // Wait if specified
                    if (action.wait) {
                        await this.sleep(action.wait);
                    }
                    
                    return true;
                } else {
                    console.error(`❌ Action failed: ${response.error}`);
                    
                    if (attempts < this.actionRetries) {
                        await this.sleep(1000);
                    }
                }
            } catch (error) {
                console.error(`Action error:`, error);
                
                // Try to reinject content script
                if (error.message.includes('Could not establish connection')) {
                    await this.injectContentScript();
                    await this.sleep(500);
                }
            }
        }
        
        return false;
    }

    // Execute pending task
    async executePendingTask() {
        if (!this.pendingTask || !this.isConnected) return;
        
        console.log('📋 Executing task:', this.pendingTask);
        
        // Capture screenshot and send to AI
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
                            text: `Task: ${this.pendingTask}\n\nAnalyze the screenshot and provide JSON actions to complete this task.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Continue task
    async continueTask() {
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
                            text: "Continue with the next step. What should I do now?"
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Send text to AI
    sendToAI(text) {
        if (!this.isConnected) return;
        
        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text }]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Capture screenshot with error handling
    async captureScreenshot() {
        try {
            // Check if the active tab is a chrome:// or devtools:// URL
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('devtools://'))) {
                console.log('⚠️ Cannot capture screenshot of chrome:// or devtools:// pages');
                
                // Try to find the first normal tab
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
            console.log('📸 Screenshot captured');
            return dataUrl;
        } catch (error) {
            console.error('Screenshot error:', error);
            
            // Try to activate tab and retry
            try {
                await chrome.tabs.update(this.activeTabId, { active: true });
                await this.sleep(500);
                
                const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                    format: 'jpeg',
                    quality: 85
                });
                return dataUrl;
            } catch (retryError) {
                console.error('Screenshot retry failed:', retryError);
                
                // Return a placeholder message if screenshot fails
                console.log('📸 Using fallback - no screenshot available');
                return 'data:image/jpeg;base64,'; // Empty image
            }
        }
    }

    // Ensure content script with better checking
    async ensureContentScript() {
        try {
            // Try to ping content script
            const response = await chrome.tabs.sendMessage(this.activeTabId, { 
                action: 'PING' 
            });
            
            if (response && response.success) {
                return true;
            }
        } catch (error) {
            // Content script not ready, inject it
            return await this.injectContentScript();
        }
    }

    // Inject content script
    async injectContentScript() {
        try {
            console.log('💉 Injecting content script...');
            await chrome.scripting.executeScript({
                target: { tabId: this.activeTabId },
                files: ['browser-controller.js']
            });
            await this.sleep(500);
            console.log('✅ Content script injected');
            return true;
        } catch (error) {
            console.error('Injection error:', error);
            return false;
        }
    }

    // Health monitoring
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            if (this.isConnected && this.websocket) {
                if (this.websocket.readyState !== WebSocket.OPEN) {
                    console.log('⚠️ Connection unhealthy, reconnecting...');
                    this.isConnected = false;
                    this.scheduleReconnect();
                }
            }
        }, 5000);
    }

    // Schedule reconnection
    scheduleReconnect() {
        if (this.reconnectTimeout) return;
        
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            
            if (!this.isConnected && this.activeTabId) {
                console.log('🔄 Attempting to reconnect...');
                this.notify('status', '🔄 Reconnecting...');
                
                const connected = await this.connectWithRetries();
                if (connected && this.pendingTask) {
                    await this.executePendingTask();
                }
            }
        }, 3000);
    }

    // Send notification
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
        console.log('🛑 Stopping automation');
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnected = false;
        this.activeTabId = null;
        this.pendingTask = null;
        this.notify('status', '🛑 Automation stopped');
    }

    // Utility: sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get optimized system prompt
    getSystemPrompt() {
        return `You are an expert browser automation assistant. You help users complete tasks by controlling their browser.

CRITICAL: You MUST respond with ONLY valid JSON. No explanations outside JSON.

RESPONSE FORMAT:
{
  "thought": "What I'm doing",
  "actions": [
    {"action": "type", "selector": "input[name='q']", "text": "search term"},
    {"action": "click", "selector": "button[type='submit']"}
  ],
  "complete": false,
  "nextStep": "What happens next"
}

AVAILABLE ACTIONS:
• navigate: {"action": "navigate", "url": "https://example.com"}
• click: {"action": "click", "selector": "button.submit"}
• type: {"action": "type", "selector": "input#search", "text": "text", "clear": true}
• scroll: {"action": "scroll", "direction": "down", "amount": 500}
• wait: {"action": "wait", "time": 2000}
• press: {"action": "press", "key": "Enter"}
• select: {"action": "select", "selector": "select#options", "value": "option1"}

SELECTOR STRATEGIES:
1. Use simple text for buttons/links: "Search", "Sign in", "Submit"
2. Use placeholder text for inputs: "Search", "Enter location"
3. Use aria-label when visible
4. Use CSS selectors as fallback
5. For Google search: "Search" for input, "Google Search" for button

IMPORTANT RULES:
1. ALWAYS start with navigate action if you need to go to a website
2. ALWAYS respond with valid JSON only
3. Use simple text selectors when possible
4. Add wait actions after navigation (3000ms minimum)
5. If an element is not found, try a different selector or navigate first
6. Set complete:true only when task is fully done`;
    }
}

// Initialize the engine
const automationEngine = new RobustAutomationEngine();
automationEngine.initialize();