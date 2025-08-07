// Gemini Live API WebSocket streaming module for real-time screen sharing
// This module handles continuous screenshot capture and streaming to Gemini

class GeminiLiveStream {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isStreaming = false;
        this.screenshotInterval = null;
        this.currentTabId = null;
        this.sessionConfig = null;
        
        // WebSocket endpoint for Gemini Live API
        this.wsEndpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
        
        // Configuration for live streaming
        this.config = {
            model: 'gemini-2.0-flash-live',  // Live model for real-time interaction
            screenshotInterval: 1000,  // Capture every 1 second
            maxWidth: 1024,
            maxHeight: 1024,
            imageQuality: 0.7,  // JPEG quality for bandwidth optimization
            systemInstructions: `You are a web automation assistant with LIVE visual access to the user's screen.
                
                IMPORTANT RULES:
                1. You can ONLY perform these actions:
                   - CLICK: Click on elements (buttons, links, inputs)
                   - TYPE: Type text into input fields
                   - SCROLL: Scroll the page up or down
                   - TAP: Mobile-style tap gesture
                
                2. You CANNOT:
                   - Modify website code or DOM
                   - Execute JavaScript
                   - Access developer tools
                   - Manipulate CSS or HTML
                
                3. INTERACTION GUIDELINES:
                   - Watch the screen in real-time
                   - Provide natural guidance like "Click the blue button" or "Type your email"
                   - Be conversational and helpful
                   - Describe what you see on screen
                   - Guide users step-by-step
                
                4. RESPONSE FORMAT:
                   When you want to perform an action, respond with:
                   ACTION: [type] TARGET: [description] VALUE: [if typing]
                   Example: "ACTION: click TARGET: search button"
                   Example: "ACTION: type TARGET: email input VALUE: user@example.com"
                   Example: "ACTION: scroll TARGET: page VALUE: down"
                
                Remember: You're seeing the screen live, so be responsive to changes!`
        };
    }

    // Initialize WebSocket connection
    async connect(tabId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        this.currentTabId = tabId;
        
        return new Promise((resolve, reject) => {
            try {
                // Create WebSocket connection with API key in URL
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
                console.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    // Send initial setup message
    sendSetupMessage() {
        const setupMessage = {
            setup: {
                model: this.config.model,
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 2048,
                    responseMimeType: 'text/plain'
                },
                systemInstruction: {
                    parts: [{
                        text: this.config.systemInstructions
                    }]
                },
                tools: [{
                    functionDeclarations: [
                        {
                            name: 'performAction',
                            description: 'Perform a web automation action',
                            parameters: {
                                type: 'object',
                                properties: {
                                    action: {
                                        type: 'string',
                                        enum: ['click', 'type', 'scroll', 'tap'],
                                        description: 'The type of action to perform'
                                    },
                                    target: {
                                        type: 'string',
                                        description: 'Description or selector of the target element'
                                    },
                                    value: {
                                        type: 'string',
                                        description: 'Value for type action or scroll direction'
                                    }
                                },
                                required: ['action', 'target']
                            }
                        }
                    ]
                }]
            }
        };
        
        this.sendMessage(setupMessage);
    }

    // Start streaming screenshots
    async startStreaming() {
        if (this.isStreaming) {
            console.log('Already streaming');
            return;
        }

        this.isStreaming = true;
        
        // Send initial screenshot
        await this.captureAndSendScreenshot();
        
        // Set up interval for continuous capture
        this.screenshotInterval = setInterval(async () => {
            if (this.isStreaming) {
                await this.captureAndSendScreenshot();
            }
        }, this.config.screenshotInterval);
        
        console.log('Started streaming screenshots every 1 second');
    }

    // Stop streaming
    stopStreaming() {
        this.isStreaming = false;
        
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        
        console.log('Stopped streaming');
    }

    // Capture screenshot and send via WebSocket
    async captureAndSendScreenshot() {
        if (!this.currentTabId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            // Request screenshot from content script
            const response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(this.currentTabId, {
                    action: 'captureScreenshot',
                    options: {
                        maxWidth: this.config.maxWidth,
                        maxHeight: this.config.maxHeight,
                        quality: this.config.imageQuality
                    }
                }, resolve);
            });

            if (response && response.screenshot) {
                // Send screenshot as realtime input
                const message = {
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: 'image/jpeg',
                            data: response.screenshot.split(',')[1]  // Remove data:image/jpeg;base64, prefix
                        }]
                    }
                };
                
                this.sendMessage(message);
                console.log('Screenshot sent to Gemini Live API');
            }
        } catch (error) {
            console.error('Failed to capture/send screenshot:', error);
        }
    }

    // Send text message to Gemini
    sendTextMessage(text) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{
                        text: text
                    }]
                }]
            }
        };
        
        this.sendMessage(message);
    }

    // Send message via WebSocket
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not ready');
        }
    }

    // Handle incoming messages from Gemini
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            // Handle different message types
            if (message.serverContent) {
                this.handleServerContent(message.serverContent);
            } else if (message.toolCall) {
                this.handleToolCall(message.toolCall);
            } else if (message.setupComplete) {
                console.log('Setup complete, ready for streaming');
                // Notify that setup is complete
                chrome.runtime.sendMessage({
                    action: 'liveStreamReady'
                });
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    // Handle server content (Gemini's responses)
    handleServerContent(content) {
        if (content.modelTurn && content.modelTurn.parts) {
            content.modelTurn.parts.forEach(part => {
                if (part.text) {
                    console.log('Gemini says:', part.text);
                    
                    // Parse for action commands
                    const actionMatch = part.text.match(/ACTION:\s*(\w+)\s*TARGET:\s*([^\n]+?)(?:\s*VALUE:\s*([^\n]+))?/i);
                    if (actionMatch) {
                        const [, action, target, value] = actionMatch;
                        this.executeAction(action.toLowerCase(), target.trim(), value?.trim());
                    }
                    
                    // Send response to UI
                    chrome.runtime.sendMessage({
                        action: 'liveStreamResponse',
                        text: part.text
                    });
                }
            });
        }
    }

    // Handle tool calls from Gemini
    handleToolCall(toolCall) {
        if (toolCall.functionCalls) {
            toolCall.functionCalls.forEach(call => {
                if (call.name === 'performAction') {
                    const args = call.args;
                    this.executeAction(args.action, args.target, args.value);
                }
            });
        }
    }

    // Execute automation action
    async executeAction(action, target, value) {
        console.log(`Executing: ${action} on ${target}${value ? ' with value: ' + value : ''}`);
        
        // Send to content script for execution
        chrome.tabs.sendMessage(this.currentTabId, {
            action: 'executeLiveAction',
            actionData: {
                type: action,
                description: `${action} ${target}`,
                selector: this.inferSelector(target),
                text: value,
                value: value
            }
        }, (response) => {
            if (response && response.success) {
                console.log('Action executed successfully');
                
                // Send confirmation back to Gemini
                const toolResponse = {
                    toolResponse: {
                        functionResponses: [{
                            name: 'performAction',
                            response: {
                                success: true,
                                message: `Successfully performed ${action} on ${target}`
                            }
                        }]
                    }
                };
                this.sendMessage(toolResponse);
            } else {
                console.error('Action failed:', response?.error);
            }
        });
    }

    // Infer selector from natural language description
    inferSelector(description) {
        const lower = description.toLowerCase();
        
        // Common patterns
        if (lower.includes('search')) return 'input[type="search"], input[name="q"], input[placeholder*="search"]';
        if (lower.includes('email')) return 'input[type="email"], input[name="email"]';
        if (lower.includes('password')) return 'input[type="password"]';
        if (lower.includes('submit') || lower.includes('button')) return 'button[type="submit"], input[type="submit"], button';
        if (lower.includes('link')) return 'a';
        
        // Try to extract ID or class
        const idMatch = description.match(/#(\w+)/);
        if (idMatch) return `#${idMatch[1]}`;
        
        const classMatch = description.match(/\.(\w+)/);
        if (classMatch) return `.${classMatch[1]}`;
        
        // Default to searching for text content
        return `*:contains("${description}")`;
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiLiveStream;
}