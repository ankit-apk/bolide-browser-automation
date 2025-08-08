// Step-by-Step Browser Automation Engine
// Executes one action at a time with verification

class StepByStepAutomationEngine {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.currentTask = null;
        this.currentStep = null;
        this.taskComplete = false;
        this.messageBuffer = '';
        this.connectionAttempts = 0;
        this.maxRetries = 3;
    }

    // Initialize
    async initialize() {
        console.log('🚀 Initializing Step-by-Step Automation Engine');
        
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
    }

    // Handle messages from UI
    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.action);
        
        try {
            switch (request.action) {
                case 'SET_API_KEY':
                    this.apiKey = request.data.apiKey;
                    await chrome.storage.local.set({ geminiApiKey: this.apiKey });
                    console.log('API key saved');
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
                    this.taskComplete = false;
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
        this.taskComplete = false;
        
        console.log('🎯 Starting automation with task:', initialTask);
        this.notify('status', 'Connecting to AI...');
        
        // Connect to Gemini
        const connected = await this.connectToGemini();
        
        if (!connected) {
            this.notify('error', '❌ Failed to connect');
            return false;
        }

        this.notify('status', '✅ Connected! Ready for tasks');
        
        // Start the task if provided
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
                    
                    // Wait for setup complete
                    let setupResolved = false;
                    const setupTimeout = setTimeout(() => {
                        if (!setupResolved) {
                            console.log('✅ Setup timeout - continuing');
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
                            console.log('✅ Setup complete confirmed');
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
        console.log('handleGeminiMessage - event type:', typeof event.data);
        
        let data;
        
        // Handle binary/blob data
        if (event.data instanceof Blob) {
            console.log('Handling Blob data...');
            const text = await event.data.text();
            console.log('Blob text:', text);
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse blob:', e);
                return;
            }
        } else {
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error('Failed to parse message:', e);
                console.error('Raw data:', event.data);
                return;
            }
        }

        console.log('Parsed message data:', JSON.stringify(data).substring(0, 200));

        // Handle server content
        if (data.serverContent) {
            // Accumulate response
            if (data.serverContent.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                    if (part.text) {
                        console.log('Accumulating text:', part.text.substring(0, 100));
                        this.messageBuffer += part.text;
                    }
                }
            }

            // Process complete response
            if (data.serverContent.turnComplete) {
                console.log('📝 Complete response received, buffer length:', this.messageBuffer.length);
                if (this.messageBuffer.length > 0) {
                    await this.processAIResponse(this.messageBuffer);
                    this.messageBuffer = '';
                } else {
                    console.log('⚠️ Empty message buffer on turnComplete');
                }
            }
        }
    }

    // Process AI response
    async processAIResponse(responseText) {
        try {
            console.log('🤖 AI Raw Response:', responseText);
            
            // Clean the response text (remove markdown code blocks if present)
            let cleanedText = responseText;
            if (responseText.includes('```json')) {
                cleanedText = responseText.replace(/```json\s*/g, '').replace(/```/g, '');
            } else if (responseText.includes('```')) {
                cleanedText = responseText.replace(/```\s*/g, '');
            }
            
            // Try to extract JSON
            let response;
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                try {
                    response = JSON.parse(jsonMatch[0]);
                    console.log('📋 Parsed response:', response);
                } catch (parseError) {
                    console.error('Parse error:', parseError);
                    // Try to fix common JSON issues
                    let fixedJson = jsonMatch[0]
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']')
                        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to keys
                        .replace(/:\s*'([^']*)'/g, ': "$1"'); // Replace single quotes with double
                    
                    try {
                        response = JSON.parse(fixedJson);
                        console.log('📋 Fixed and parsed response:', response);
                    } catch (e) {
                        console.error('Cannot parse JSON even after fixes:', e);
                        console.error('Attempted to parse:', fixedJson);
                        this.notify('error', '❌ Invalid response format');
                        return;
                    }
                }
            } else {
                console.log('No JSON found in response');
                // No JSON found
                this.notify('message', `AI: ${responseText}`);
                return;
            }

            // Handle different response types
            if (response.type === 'next_action') {
                // Execute the single action
                await this.executeSingleAction(response);
            } else if (response.type === 'verification') {
                // Handle verification result
                await this.handleVerification(response);
            } else if (response.type === 'task_complete') {
                // Task is complete
                this.handleTaskComplete(response);
            } else {
                // Try to infer the type from the response structure
                if (response.action) {
                    // Treat as next_action
                    await this.executeSingleAction({
                        type: 'next_action',
                        thought: response.thought,
                        action: response.action
                    });
                } else if (response.success !== undefined) {
                    // Treat as verification
                    await this.handleVerification(response);
                } else if (response.message && (response.complete || response.task_complete)) {
                    // Treat as task_complete
                    this.handleTaskComplete(response);
                } else {
                    console.error('Unknown response format:', response);
                    this.notify('error', '❌ Unknown response format from AI');
                }
            }

        } catch (error) {
            console.error('Error processing response:', error);
            this.notify('error', '❌ Failed to process AI response');
        }
    }

    // Execute a single action
    async executeSingleAction(response) {
        console.log('executeSingleAction called with:', response);
        
        if (!response.action) {
            console.log('No action to execute in response');
            return;
        }

        const actionType = response.action.type || response.action.action;
        console.log(`⚡ Executing action type: ${actionType}`);
        console.log('Full action details:', response.action);
        
        // Show thought if provided
        if (response.thought) {
            this.notify('message', `🤔 ${response.thought}`);
        }

        // If AI signals completion, handle it immediately
        if (actionType === 'complete') {
            this.handleTaskComplete({ message: response.action.message || 'Task completed' });
            return;
        }

        // Execute the action
        const success = await this.executeAction(response.action);
        
        if (success) {
            this.notify('action', `✅ ${actionType}: ${response.action.selector || response.action.url || ''}`);
            
            // Wait a bit for the action to complete
            const waitTime = response.action.wait || response.action.time || 1000;
            console.log(`Waiting ${waitTime}ms for action to complete`);
            await this.sleep(waitTime);
            
            // Verify the action completed
            console.log('Verifying action completion...');
            await this.verifyAction();
        } else {
            this.notify('error', `❌ Failed: ${actionType}`);
            
            // Ask AI what to do next
            console.log('Action failed, asking for alternative...');
            await this.askForAlternative();
        }
    }

    // Execute an action
    async executeAction(action) {
        console.log('executeAction called with:', action);
        
        // Normalize action for content script compatibility
        const normalized = { ...action };
        if ((normalized.type || normalized.action) === 'press_enter') {
            normalized.type = 'press';
            normalized.key = 'Enter';
            delete normalized.action;
        }

        try {
            // Ensure content script is ready
            const scriptReady = await this.ensureContentScript();
            console.log('Content script ready:', scriptReady);

            // Send action to content script
            console.log('Sending action to content script...');
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'EXECUTE_ACTION',
                data: normalized
            });
            
            console.log('Content script response:', response);
            return response.success;
        } catch (error) {
            console.error('Action execution error:', error);
            
            // Try to reinject content script
            if (error.message && error.message.includes('Could not establish connection')) {
                console.log('Connection lost, reinjecting content script...');
                await this.injectContentScript();
                await this.sleep(500);
                
                try {
                    const retryResponse = await chrome.tabs.sendMessage(this.activeTabId, {
                        action: 'EXECUTE_ACTION',
                        data: normalized
                    });
                    console.log('Retry response:', retryResponse);
                    return retryResponse.success;
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    return false;
                }
            }
            
            return false;
        }
    }

    // Verify action completed
    async verifyAction() {
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            console.error('Failed to capture screenshot for verification');
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
                            text: `Did the last action complete successfully? Look at the screenshot and verify. If yes, what should be the next step for the task: "${this.currentTask}"? If no, what alternative action should we try?`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Handle verification response
    async handleVerification(response) {
        if (response.success) {
            console.log('✅ Action verified successful');
            
            if (response.next_action) {
                // Execute next action
                await this.executeSingleAction({ 
                    action: response.next_action, 
                    thought: response.thought 
                });
            } else if (response.task_complete) {
                // Task is complete
                this.handleTaskComplete(response);
            } else {
                // Ask for next step
                await this.askForNextStep();
            }
        } else {
            console.log('❌ Action verification failed');
            
            if (response.alternative_action) {
                // Try alternative action
                await this.executeSingleAction({ 
                    action: response.alternative_action, 
                    thought: response.thought 
                });
            } else {
                // Ask for help
                await this.askForAlternative();
            }
        }
    }

    // Handle task completion
    handleTaskComplete(response) {
        console.log('🎉 Task completed!');
        this.taskComplete = true;
        this.currentTask = null;
        
        if (response.message) {
            this.notify('success', `✅ ${response.message}`);
        } else {
            this.notify('success', '✅ Task completed successfully!');
        }
    }

    // Start a new task
    async startNewTask() {
        if (!this.currentTask || !this.isConnected) return;
        
        console.log('📋 Starting new task:', this.currentTask);
        this.taskComplete = false;
        
        // Capture screenshot
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
            this.notify('error', '❌ Failed to capture screenshot');
            return;
        }

        // Ask for first step
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
                            text: `Task: ${this.currentTask}\n\nLook at the current screen. What is the FIRST SINGLE action I should take to start this task? Provide only ONE action.`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Ask for next step
    async askForNextStep() {
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
                            text: `Current task: ${this.currentTask}\n\nWhat is the NEXT SINGLE action to continue this task?`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Ask for alternative action
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
                            text: `The last action failed. Task: ${this.currentTask}\n\nWhat alternative action should we try?`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
    }

    // Capture screenshot
    async captureScreenshot() {
        try {
            // Check if the active tab is valid
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('devtools://'))) {
                console.log('⚠️ Cannot capture screenshot of chrome:// or devtools:// pages');
                
                // Find a normal tab
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
            return null;
        }
    }

    // Ensure content script is injected
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
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnected = false;
        this.activeTabId = null;
        this.currentTask = null;
        this.taskComplete = false;
        this.notify('status', '🛑 Automation stopped');
    }

    // Utility: sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get system prompt
    getSystemPrompt() {
        return `You are a browser automation assistant. Execute ONE action at a time.

CRITICAL: Respond with ONLY valid JSON.

When asked for an action, respond with:
{
  "thought": "What I'm doing",
  "action": {
    "type": "navigate|click|type|wait|press_enter|complete",
    "url": "https://example.com (for navigate)",
    "selector": "CSS selector or visible text (for click/type)",
    "text": "text to type (for type)",
    "message": "What was accomplished (for complete)"
  }
}

RULES:
- If the task names a specific site/domain (e.g., amazon.in, linkedin.com), NAVIGATE there first
- Prefer text inputs (textarea[name="q"], input[name="q"]) and avoid voice/mic buttons
- After typing in a search box, use press_enter, then add a wait of ~1500-2000ms
- Include wait after any navigation or page-changing click
- Use complete when the goal is achieved, with a clear message

EXAMPLES:
Navigate: {"type": "navigate", "url": "https://www.amazon.in"}
Click: {"type": "click", "selector": "input[name='q']"}
Type: {"type": "type", "selector": "input[name='q']", "text": "rich dad poor dad"}
Press Enter: {"type": "press_enter"}
Wait: {"type": "wait", "time": 2000}
Complete: {"type": "complete", "message": "On Amazon.in product page for Rich Dad Poor Dad"}`;
    }
}

// Initialize the engine
const automationEngine = new StepByStepAutomationEngine();
automationEngine.initialize();