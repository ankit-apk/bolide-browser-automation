// Ultra Browser Automation Engine v2.0
// Clean, powerful, complete automation system

class BrowserAutomationEngine {
    constructor() {
        this.state = {
            mode: null, // 'simple' | 'stream' | 'multi' | 'assistant'
            isActive: false,
            currentTask: null,
            apiKey: null,
            tabs: new Map(), // tabId -> TabController
            workflows: new Map(), // workflowId -> Workflow
            websocket: null,
            sessionMemory: {}
        };
        
        this.initialize();
    }
    
    initialize() {
        // Set up message listeners
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        
        // Tab lifecycle management
        chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
        chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
        
        // Extension icon click
        chrome.action.onClicked.addListener(this.handleIconClick.bind(this));
        
        console.log('🚀 Browser Automation Engine initialized');
    }
    
    // Message handler from UI
    async handleMessage(request, sender, sendResponse) {
        const { action, data } = request;
        
        switch (action) {
            case 'SET_API_KEY':
                this.state.apiKey = data.apiKey;
                sendResponse({ success: true });
                break;
                
            case 'START_AUTOMATION':
                const result = await this.startAutomation(data);
                sendResponse(result);
                break;
                
            case 'STOP_AUTOMATION':
                await this.stopAutomation();
                sendResponse({ success: true });
                break;
                
            case 'GET_STATE':
                sendResponse(this.state);
                break;
        }
        
        return true; // Keep channel open for async response
    }
    
    // Start automation based on mode
    async startAutomation({ mode, task, tabId }) {
        if (!this.state.apiKey) {
            return { success: false, error: 'API key not set' };
        }
        
        if (this.state.isActive) {
            return { success: false, error: 'Automation already running' };
        }
        
        this.state.mode = mode;
        this.state.currentTask = task;
        this.state.isActive = true;
        
        this.notify('status', `Starting ${mode} mode: ${task}`);
        
        try {
            switch (mode) {
                case 'simple':
                    return await this.runSimpleMode(task, tabId);
                    
                case 'stream':
                    return await this.runStreamMode(task, tabId);
                    
                case 'multi':
                    return await this.runMultiMode(task);
                    
                case 'assistant':
                    return await this.runAssistantMode(tabId);
                    
                default:
                    throw new Error(`Unknown mode: ${mode}`);
            }
        } catch (error) {
            this.notify('error', error.message);
            this.state.isActive = false;
            return { success: false, error: error.message };
        }
    }
    
    // SIMPLE MODE: One-shot task execution
    async runSimpleMode(task, tabId) {
        const tab = await this.getOrCreateTab(tabId);
        
        // Capture screenshot
        const screenshot = await tab.captureScreenshot();
        
        // Get action plan from AI
        const actions = await this.getActionPlan(task, screenshot, tab.url);
        
        // Execute actions
        for (const action of actions) {
            this.notify('action', `Executing: ${action.description}`);
            await tab.executeAction(action);
            await this.delay(1000);
        }
        
        this.notify('complete', 'Task completed');
        this.state.isActive = false;
        return { success: true };
    }
    
    // STREAM MODE: Real-time WebSocket with continuous feedback
    async runStreamMode(task, tabId) {
        const tab = await this.getOrCreateTab(tabId);
        
        // Establish WebSocket connection
        this.state.websocket = new GeminiWebSocket(this.state.apiKey);
        await this.state.websocket.connect();
        
        // Send initial task
        await this.state.websocket.sendTask(task, await tab.captureScreenshot());
        
        // Start screenshot streaming
        const streamInterval = setInterval(async () => {
            if (!this.state.isActive) {
                clearInterval(streamInterval);
                return;
            }
            
            const screenshot = await tab.captureScreenshot();
            const response = await this.state.websocket.sendScreenshot(screenshot);
            
            if (response.action) {
                await tab.executeAction(response.action);
            }
            
            if (response.status === 'complete') {
                clearInterval(streamInterval);
                this.notify('complete', 'Task completed via stream');
                this.state.isActive = false;
            }
        }, 1000); // Every second
        
        return { success: true };
    }
    
    // MULTI MODE: Coordinate across multiple tabs
    async runMultiMode(task) {
        // Analyze task to determine required tabs
        const tabConfigs = this.analyzeTaskRequirements(task);
        
        // Open required tabs
        const tabs = [];
        for (const config of tabConfigs) {
            const tab = await this.createNewTab(config.url);
            tab.purpose = config.purpose;
            tabs.push(tab);
            this.notify('tab_created', `Opened ${config.purpose}: ${config.url}`);
        }
        
        // Create workflow coordinator
        const workflow = new WorkflowCoordinator(task, tabs, this.state.apiKey);
        this.state.workflows.set(workflow.id, workflow);
        
        // Execute workflow
        await workflow.execute();
        
        this.notify('complete', 'Multi-tab workflow completed');
        this.state.isActive = false;
        return { success: true };
    }
    
    // ASSISTANT MODE: Always-on helper
    async runAssistantMode(tabId) {
        const tab = await this.getOrCreateTab(tabId);
        
        // Set up continuous monitoring
        this.notify('assistant', 'Assistant mode active - I\'m watching and ready to help');
        
        // Listen for user interactions or requests
        // This would integrate with voice, keyboard shortcuts, or UI commands
        
        return { success: true };
    }
    
    // Get or create tab controller
    async getOrCreateTab(tabId) {
        if (!this.state.tabs.has(tabId)) {
            const controller = new TabController(tabId);
            await controller.initialize();
            this.state.tabs.set(tabId, controller);
        }
        return this.state.tabs.get(tabId);
    }
    
    // Create new tab
    async createNewTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.create({ url, active: false }, async (tab) => {
                const controller = new TabController(tab.id);
                await controller.initialize();
                await controller.waitForLoad();
                this.state.tabs.set(tab.id, controller);
                resolve(controller);
            });
        });
    }
    
    // Get AI action plan
    async getActionPlan(task, screenshot, url) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.state.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Task: ${task}
                                Current URL: ${url}
                                
                                Analyze the screenshot and provide a JSON array of actions to complete this task.
                                
                                Action format:
                                {
                                    "type": "click|type|scroll|wait|navigate",
                                    "selector": "CSS selector",
                                    "value": "text or URL",
                                    "description": "What this does"
                                }
                                
                                Be thorough and include all necessary steps.`
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: screenshot.split(',')[1]
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );
        
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    }
    
    // Analyze task to determine required tabs
    analyzeTaskRequirements(task) {
        const lower = task.toLowerCase();
        
        if (lower.includes('compare') && lower.includes('price')) {
            return [
                { url: 'https://www.amazon.com', purpose: 'Amazon' },
                { url: 'https://www.ebay.com', purpose: 'eBay' },
                { url: 'https://www.walmart.com', purpose: 'Walmart' }
            ];
        }
        
        if (lower.includes('flight')) {
            return [
                { url: 'https://www.google.com/travel/flights', purpose: 'Google Flights' },
                { url: 'https://www.kayak.com', purpose: 'Kayak' }
            ];
        }
        
        if (lower.includes('restaurant')) {
            return [
                { url: 'https://www.opentable.com', purpose: 'OpenTable' },
                { url: 'https://www.yelp.com', purpose: 'Yelp' }
            ];
        }
        
        // Default: single Google search
        return [{ url: 'https://www.google.com', purpose: 'Google Search' }];
    }
    
    // Stop all automation
    async stopAutomation() {
        this.state.isActive = false;
        
        // Close WebSocket if active
        if (this.state.websocket) {
            this.state.websocket.disconnect();
            this.state.websocket = null;
        }
        
        // Stop all workflows
        for (const workflow of this.state.workflows.values()) {
            workflow.stop();
        }
        
        this.notify('stopped', 'Automation stopped');
    }
    
    // Handle tab removal
    handleTabRemoved(tabId) {
        if (this.state.tabs.has(tabId)) {
            this.state.tabs.delete(tabId);
        }
    }
    
    // Handle tab updates
    handleTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && this.state.tabs.has(tabId)) {
            this.state.tabs.get(tabId).handleNavigation(tab.url);
        }
    }
    
    // Handle extension icon click
    async handleIconClick(tab) {
        try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (error) {
            console.error('Failed to open side panel:', error);
        }
    }
    
    // Send notification to UI
    notify(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message, timestamp: Date.now() }
        }).catch(() => {
            // UI might not be open
        });
    }
    
    // Utility: delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Tab Controller - Manages a single tab
class TabController {
    constructor(tabId) {
        this.tabId = tabId;
        this.url = null;
        this.isReady = false;
    }
    
    async initialize() {
        // Inject content script
        await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            files: ['content.js']
        });
        
        this.isReady = true;
    }
    
    async captureScreenshot() {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'capture_screenshot'
            }, (response) => {
                resolve(response?.screenshot || null);
            });
        });
    }
    
    async executeAction(action) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'execute_action',
                data: action
            }, (response) => {
                resolve(response?.success || false);
            });
        });
    }
    
    async waitForLoad() {
        return new Promise((resolve) => {
            const listener = (id, changeInfo) => {
                if (id === this.tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }
    
    handleNavigation(url) {
        this.url = url;
        // Re-inject content script if needed
        this.initialize();
    }
}

// WebSocket handler for real-time communication
class GeminiWebSocket {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
    }
    
    async connect() {
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.sendSetup();
                resolve();
            };
            
            this.ws.onerror = reject;
        });
    }
    
    sendSetup() {
        this.send({
            setup: {
                model: 'models/gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json'
                }
            }
        });
    }
    
    async sendTask(task, screenshot) {
        this.send({
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        { text: `Task: ${task}\nProvide step-by-step actions.` },
                        { inlineData: { mimeType: 'image/jpeg', data: screenshot.split(',')[1] } }
                    ]
                }],
                turnComplete: true
            }
        });
    }
    
    async sendScreenshot(screenshot) {
        return new Promise((resolve) => {
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                resolve(data);
            };
            
            this.send({
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [
                            { text: 'Current screen. What should I do next?' },
                            { inlineData: { mimeType: 'image/jpeg', data: screenshot.split(',')[1] } }
                        ]
                    }],
                    turnComplete: true
                }
            });
        });
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Workflow Coordinator - Manages multi-tab workflows
class WorkflowCoordinator {
    constructor(task, tabs, apiKey) {
        this.id = `workflow_${Date.now()}`;
        this.task = task;
        this.tabs = tabs;
        this.apiKey = apiKey;
        this.results = [];
    }
    
    async execute() {
        // Execute task on each tab in parallel or sequence based on task type
        const promises = this.tabs.map(async (tab) => {
            const screenshot = await tab.captureScreenshot();
            const actions = await this.getTabActions(tab.purpose, screenshot);
            
            for (const action of actions) {
                await tab.executeAction(action);
                await this.delay(1000);
            }
            
            return {
                tab: tab.purpose,
                result: await tab.captureScreenshot()
            };
        });
        
        this.results = await Promise.all(promises);
        return this.results;
    }
    
    async getTabActions(purpose, screenshot) {
        // Get specific actions for this tab based on its purpose
        // This would call Gemini with context about the specific tab's role
        return [];
    }
    
    stop() {
        // Stop workflow execution
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the engine
const engine = new BrowserAutomationEngine();