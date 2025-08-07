// Enhanced WebSocket Workflow for Real-time Task Execution
// This module maintains a persistent WebSocket connection with Gemini
// and streams screenshots every second for dynamic task adjustment

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
        
        // WebSocket endpoint for Gemini
        this.wsEndpoint = 'wss://generativelanguage.googleapis.com/v1beta/ws/google.ai.generativelanguage.v1.GenerativeService.BidiGenerateContent';
        
        this.config = {
            screenshotInterval: 1000, // Send screenshot every 1 second
            model: 'gemini-2.5-flash',
            temperature: 0.3,
            maxOutputTokens: 4096
        };
    }

    // Connect to Gemini WebSocket
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

    // Send initial setup message
    sendInitialSetup() {
        const setupMessage = {
            setup: {
                model: this.config.model,
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

    // Start a new task
    async startTask(task) {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }
        
        this.currentTask = task;
        this.stepHistory = [];
        this.stuckCounter = 0;
        
        // Capture initial screenshot
        const screenshot = await this.captureScreenshot();
        
        // Send task with initial screenshot
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
        
        // Start continuous screenshot streaming
        this.startScreenshotStream();
        
        console.log(`Task started: ${task}`);
    }

    // Start streaming screenshots every second
    startScreenshotStream() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
        }
        
        this.screenshotInterval = setInterval(async () => {
            if (!this.isConnected || !this.currentTask) return;
            
            try {
                const screenshot = await this.captureScreenshot();
                
                // Check if screen has changed
                if (screenshot === this.lastScreenshot) {
                    this.stuckCounter++;
                    
                    if (this.stuckCounter >= this.maxStuckAttempts) {
                        // Send message that we might be stuck
                        this.sendScreenshotUpdate(screenshot, true);
                    }
                } else {
                    this.stuckCounter = 0;
                    this.lastScreenshot = screenshot;
                    
                    // Send regular screenshot update if we have a pending step
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

    // Stop screenshot streaming
    stopScreenshotStream() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
            console.log('Screenshot streaming stopped');
        }
    }

    // Send screenshot update to Gemini
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

    // Capture screenshot from current tab
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

    // Handle response from Gemini
    handleGeminiResponse(data) {
        try {
            const message = JSON.parse(data);
            
            // Handle different message types
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

    // Process action response from Gemini
    processActionResponse(responseText) {
        try {
            // Try to parse as JSON
            const response = JSON.parse(responseText);
            
            console.log('Gemini response:', response);
            
            // Update UI with current analysis
            this.notifyUI('analysis', response.current_analysis);
            this.notifyUI('progress', response.progress);
            
            // Handle different statuses
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
            // If not JSON, treat as plain text response
            console.log('Gemini says:', responseText);
            this.notifyUI('message', responseText);
        }
    }

    // Execute the next action
    async executeNextAction(action) {
        if (!action) {
            console.error('No action provided');
            return;
        }
        
        this.currentStep = action;
        this.stepHistory.push(action);
        
        console.log(`Executing: ${action.type} - ${action.description}`);
        this.notifyUI('action', `${action.type}: ${action.description}`);
        
        // Send action to content script
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
                // Screenshot will be sent automatically by the interval
            } else {
                console.error('Action failed:', response?.error);
                this.handleExecutionError(response?.error);
            }
        });
    }

    // Handle task completion
    handleTaskCompletion(response) {
        console.log('Task completed successfully!');
        this.notifyUI('completed', response.current_analysis);
        this.stopScreenshotStream();
        this.currentTask = null;
        this.currentStep = null;
    }

    // Handle stuck situation
    handleStuckSituation(response) {
        console.log('Stuck detected:', response.stuck_reason);
        this.notifyUI('stuck', response.stuck_reason);
        
        // Try alternative action if provided
        if (response.next_action) {
            this.executeNextAction(response.next_action);
        } else {
            // Ask for user intervention
            this.notifyUI('need_help', 'The automation is stuck and needs your help');
        }
    }

    // Handle errors
    handleError(response) {
        console.error('Task error:', response);
        this.notifyUI('error', response.reason || 'Unknown error occurred');
        this.stopScreenshotStream();
    }

    // Handle execution errors
    handleExecutionError(error) {
        // Send error screenshot to Gemini
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

    // Send message through WebSocket
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not ready');
        }
    }

    // Notify UI about updates
    notifyUI(type, data) {
        chrome.runtime.sendMessage({
            action: 'workflowUpdate',
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        }).catch(() => {
            // Side panel might not be open
        });
    }

    // Stop current task
    stopTask() {
        console.log('Stopping task');
        this.stopScreenshotStream();
        this.currentTask = null;
        this.currentStep = null;
        this.stepHistory = [];
        this.stuckCounter = 0;
        this.notifyUI('stopped', 'Task stopped by user');
    }

    // Disconnect WebSocket
    disconnect() {
        this.stopTask();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketWorkflow;
}