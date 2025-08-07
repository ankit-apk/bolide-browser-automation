// Simple Background Service Worker for AI Browser Control
class BrowserController {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        this.streamInterval = null;
    }

    async initialize() {
        // Set up side panel to be available
        await chrome.sidePanel.setOptions({
            path: 'simple-chat.html',
            enabled: true
        });
        
        // Set panel to open when action icon is clicked
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

        // Listen for messages from side panel and content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Load stored API key
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
        }
    }

    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'SET_API_KEY':
                this.apiKey = request.data.apiKey;
                sendResponse({ success: true });
                break;

            case 'START_STREAM':
                await this.startStreaming(request.data.tabId);
                sendResponse({ success: true });
                break;

            case 'STOP_STREAM':
                this.stopStreaming();
                sendResponse({ success: true });
                break;

            case 'SEND_MESSAGE':
                await this.sendUserMessage(request.data.message);
                sendResponse({ success: true });
                break;

            case 'EXECUTE_ACTION':
                await this.executeAction(request.data);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    async startStreaming(tabId) {
        if (!this.apiKey) {
            this.notifyPanel('error', 'Please set your API key first');
            return;
        }

        this.activeTabId = tabId;
        
        // Connect WebSocket and wait for it to be ready
        await this.connectWebSocket();
        
        // Send initial screenshot to show current state
        const screenshot = await this.captureScreenshot();
        if (screenshot) {
            this.sendScreenshot(screenshot);
        }
        
        this.notifyPanel('status', 'Connected - Type commands or questions below');
    }

    connectWebSocket() {
        return new Promise((resolve, reject) => {
            // Use v1alpha endpoint for Live API (as shown in Python code)
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
            
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = async () => {
                console.log('WebSocket opened, sending setup message...');
                this.notifyPanel('status', 'Connected, setting up...');
                
                // Send initial setup message (matching Python implementation)
                const setupMessage = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",  // Use Gemini 2.0 Flash
                        generationConfig: {  // Use camelCase as per API spec
                            responseModalities: ["TEXT"],  // Force text-only responses
                            temperature: 0.7,
                            topP: 0.95,
                            maxOutputTokens: 2048
                        },
                        systemInstruction: {  // Use camelCase
                            parts: [{
                                text: `You are a browser automation assistant. Your ONLY job is to provide JSON actions to control the browser.

RULES:
1. EVERY response MUST include a JSON action object
2. DO NOT just describe what you see or what you'll do
3. IMMEDIATELY provide the JSON action

For typing in search box:
{"action": "type", "selector": "input[name='q']", "value": "coffee", "description": "Typing coffee in search box"}

For clicking search button:
{"action": "click", "selector": "input[name='btnK']", "description": "Clicking Google Search button"}

For any text input field:
{"action": "type", "selector": "search", "value": "your text", "description": "Typing in field"}

EXAMPLE RESPONSE:
"I'll search for coffee. {"action": "type", "selector": "input[name='q']", "value": "coffee", "description": "Typing coffee"}"

ALWAYS include the JSON action. Never respond without it.`
                            }]
                        }
                    }
                };
                
                console.log('Sending setup:', setupMessage);
                this.websocket.send(JSON.stringify(setupMessage));
                
                // Wait for setup completion response
                const waitForSetup = () => {
                    return new Promise((setupResolve) => {
                        const originalOnMessage = this.websocket.onmessage;
                        this.websocket.onmessage = async (event) => {
                            const data = await this.parseWebSocketMessage(event);
                            if (data && data.setupComplete) {
                                console.log('Setup complete, starting operations');
                                this.isConnected = true;
                                this.notifyPanel('status', 'Connected to Gemini Live');
                                
                                // Disable automatic screenshots for now - rely on manual sending
                                // this.streamInterval = setInterval(async () => {
                                //     if (this.isConnected && this.activeTabId) {
                                //         const screenshot = await this.captureScreenshot();
                                //         if (screenshot) {
                                //             this.sendScreenshot(screenshot);
                                //         }
                                //     }
                                // }, 5000);
                                
                                // Restore original message handler
                                this.websocket.onmessage = originalOnMessage;
                                setupResolve();
                            }
                        };
                    });
                };
                
                await waitForSetup();
                resolve();
            };

            this.websocket.onmessage = async (event) => {
                try {
                    const messageData = await this.parseWebSocketMessage(event);
                    if (messageData) {
                        this.handleWebSocketMessage(messageData);
                    }
                } catch (e) {
                    console.error('Failed to handle WebSocket message:', e);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.notifyPanel('error', 'Connection error');
                reject(error);
            };

            this.websocket.onclose = () => {
                this.isConnected = false;
                this.notifyPanel('status', 'Disconnected from Gemini Live');
                // Stop screenshot streaming when disconnected
                if (this.streamInterval) {
                    clearInterval(this.streamInterval);
                    this.streamInterval = null;
                }
            };
            
            // Add timeout for connection
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('WebSocket connection timeout'));
                    this.websocket.close();
                }
            }, 10000);
        });
    }

    async parseWebSocketMessage(event) {
        try {
            let messageData;
            
            // Handle Blob data (binary messages)
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                messageData = JSON.parse(text);
            } else {
                // Handle text data
                messageData = JSON.parse(event.data);
            }
            
            // Log detailed message content
            if (messageData.serverContent) {
                if (messageData.serverContent.modelTurn && messageData.serverContent.modelTurn.parts) {
                    const parts = messageData.serverContent.modelTurn.parts;
                    for (const part of parts) {
                        if (part.text) {
                            console.log('AI Response Text:', part.text);
                        }
                    }
                }
            }
            
            return messageData;
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
            return null;
        }
    }

    async handleWebSocketMessage(data) {
        // Initialize accumulator if not exists
        if (!this.responseAccumulator) {
            this.responseAccumulator = '';
        }
        
        // Handle setup complete message (matching Python format)
        if (data.setupComplete) {
            console.log('Setup complete');
            this.notifyPanel('status', 'Setup complete - Ready to interact');
            return;
        }
        
        // Handle server content (responses) - matching Python serverContent format
        if (data.serverContent) {
            const content = data.serverContent;
            
            // Handle model turn (AI responses)
            if (content.modelTurn && content.modelTurn.parts) {
                for (const part of content.modelTurn.parts) {
                    if (part.text) {
                        // Accumulate the response
                        this.responseAccumulator += part.text;
                        console.log('AI Response Text:', part.text);
                    } else if (part.inlineData) {
                        // This is audio/binary data - log but don't process
                        console.log('Received audio/binary response - requesting text mode');
                    }
                }
            }
            
            // Check for output transcription (if audio response includes text)
            if (content.outputTranscription) {
                const transcription = content.outputTranscription.text;
                console.log('AI transcription:', transcription);
                this.notifyPanel('message', transcription);
                
                // Try to find action in transcription
                try {
                    const actionMatch = transcription.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
                    if (actionMatch) {
                        const action = JSON.parse(actionMatch[0]);
                        console.log('Found action in transcription:', action);
                        await this.executeAction(action);
                    }
                } catch (e) {
                    console.log('No action in transcription');
                }
            }
            
            // Handle turn completion - Process accumulated response
            if (content.turnComplete) {
                console.log('Turn complete, processing accumulated response:', this.responseAccumulator);
                
                if (this.responseAccumulator) {
                    // Try to find and execute JSON action in the complete response
                    try {
                        // Look for complete JSON object with action
                        const actionMatch = this.responseAccumulator.match(/\{[^{}]*"action"[^{}]*\}/);
                        if (actionMatch) {
                            console.log('Found complete action JSON:', actionMatch[0]);
                            
                            // Parse and fix the JSON if needed
                            let actionJson = actionMatch[0];
                            
                            // Fix common JSON issues from the AI
                            // Change "direction" to "value" for scroll actions
                            actionJson = actionJson.replace(/"direction":\s*"([^"]+)"/, '"value": "$1"');
                            // Remove extra fields that might break parsing
                            actionJson = actionJson.replace(/,\s*"distance":\s*"[^"]*"/, '');
                            actionJson = actionJson.replace(/,\s*"distance":\s*\d+/, '');
                            
                            let action = JSON.parse(actionJson);
                            
                            // Fix action types from AI
                            if (action.action === 'open_new_tab' || action.action === 'open_tab') {
                                action.action = 'navigate';
                                action.value = action.url || action.value;
                                delete action.url;
                            }
                            
                            // Ensure scroll has proper value
                            if (action.action === 'scroll' && !action.value) {
                                action.value = action.direction || 'down';
                            }
                            console.log('Executing action:', action);
                            
                            // Execute the action
                            await this.executeAction(action);
                            this.notifyPanel('action', action.description || 'Executing action');
                        } else {
                            // No action found, just a message
                            console.log('No action found in response');
                            this.notifyPanel('message', this.responseAccumulator);
                        }
                    } catch (e) {
                        console.error('Failed to parse action from accumulated response:', e);
                        this.notifyPanel('message', this.responseAccumulator);
                    }
                    
                    // Clear accumulator for next response
                    this.responseAccumulator = '';
                }
            }
        }
        
        // Handle errors
        if (data.error) {
            console.error('WebSocket error:', data.error);
            this.notifyPanel('error', `Error: ${data.error.message || 'Unknown error'}`);
        }
    }

    async captureScreenshot() {
        try {
            // Use Chrome's built-in screenshot API directly
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 90  // Higher quality for better AI recognition
            });
            console.log('Screenshot captured successfully');
            return dataUrl;
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            // Fallback to content script method
            try {
                await this.ensureContentScript(this.activeTabId);
                const response = await chrome.tabs.sendMessage(this.activeTabId, {
                    action: 'CAPTURE_SCREENSHOT'
                });
                return response.screenshot;
            } catch (fallbackError) {
                console.error('Fallback capture also failed:', fallbackError);
                return null;
            }
        }
    }
    
    async ensureContentScript(tabId) {
        try {
            // Check if content script is already injected
            await chrome.tabs.sendMessage(tabId, { action: 'PING' });
        } catch (error) {
            // Content script not injected, inject it now
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['simple-content.js']
                });
                console.log('Content script injected');
            } catch (injectError) {
                console.error('Failed to inject content script:', injectError);
            }
        }
    }

    sendScreenshot(screenshot) {
        if (this.websocket && this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
            // Send just the screenshot without text prompt (to avoid confusion)
            const message = {
                clientContent: {  // Use camelCase
                    turns: [{
                        role: "user",
                        parts: [{
                            inlineData: {  // Use camelCase
                                mimeType: "image/jpeg",  // Use camelCase
                                data: screenshot.split(',')[1]
                            }
                        }]
                    }],
                    turnComplete: true  // Use camelCase
                }
            };
            try {
                console.log('Sending screenshot to AI');
                this.websocket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send screenshot:', error);
            }
        }
    }

    async sendUserMessage(text) {
        if (this.websocket && this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
            try {
                // Take a screenshot first
                const screenshot = await this.captureScreenshot();
                
                // Build message with both screenshot and text
                const parts = [];
                
                // Add screenshot if available
                if (screenshot) {
                    parts.push({
                        inlineData: {  // Use camelCase
                            mimeType: "image/jpeg",  // Use camelCase
                            data: screenshot.split(',')[1]
                        }
                    });
                }
                
                // Add the text command
                parts.push({ 
                    text: text + "\n\nProvide the JSON action immediately. Example: {\"action\": \"type\", \"selector\": \"input[name='q']\", \"value\": \"coffee\", \"description\": \"Typing coffee\"}"
                });
                
                const message = {
                    clientContent: {  // Use camelCase
                        turns: [{
                            role: "user",
                            parts: parts
                        }],
                        turnComplete: true  // Use camelCase
                    }
                };
                
                console.log('Sending user message with screenshot:', text);
                this.websocket.send(JSON.stringify(message));
                this.notifyPanel('user_message', text);
            } catch (error) {
                console.error('Failed to send message:', error);
                this.notifyPanel('error', 'Failed to send message');
            }
        } else {
            this.notifyPanel('error', 'Not connected. Please start streaming first.');
        }
    }

    async executeAction(action) {
        if (!this.activeTabId) {
            console.error('No active tab ID for action execution');
            return;
        }

        console.log('Sending action to content script:', action);
        try {
            // Ensure content script is injected first
            await this.ensureContentScript(this.activeTabId);
            
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'EXECUTE_ACTION',
                data: action
            });
            
            console.log('Action execution response:', response);
        } catch (error) {
            console.error('Failed to execute action:', error);
            this.notifyPanel('error', `Failed to execute action: ${error.message}`);
        }
    }

    stopStreaming() {
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.isConnected = false;
        this.activeTabId = null;
        this.notifyPanel('status', 'Stream stopped');
    }

    notifyPanel(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message }
        }).catch(() => {
            // Panel might not be open
        });
    }
}

// Initialize controller
const controller = new BrowserController();
controller.initialize();