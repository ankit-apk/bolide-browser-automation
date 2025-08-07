// Simplified Multi-Tab Manager for coordinating across tabs
class MultiTabManager {
    constructor() {
        this.activeTabs = new Map();
        this.workflows = new Map();
        this.tabConnections = new Map();
    }

    async createWorkflow(task, apiKey) {
        const workflowId = `workflow_${Date.now()}`;
        const workflow = {
            id: workflowId,
            task: task,
            status: 'initializing',
            tabs: [],
            startTime: Date.now()
        };
        
        this.workflows.set(workflowId, workflow);
        
        // Analyze task and create tabs
        const requiredTabs = this.analyzeTask(task);
        
        sendWorkflowUpdate({
            log: `Creating ${requiredTabs.length} tabs for workflow`,
            logType: 'info'
        });
        
        // Create tabs
        for (const tabConfig of requiredTabs) {
            const tab = await this.createTab(tabConfig.url);
            workflow.tabs.push(tab.id);
            
            sendWorkflowUpdate({
                log: `Opened tab: ${tabConfig.purpose} - ${tabConfig.url}`,
                logType: 'success'
            });
            
            // Wait for tab to load
            await this.waitForTabLoad(tab.id);
            
            // Establish WebSocket connection for tab
            const connection = new TabConnection(tab.id, apiKey);
            await connection.connect();
            this.tabConnections.set(tab.id, connection);
        }
        
        // Execute workflow
        await this.executeWorkflow(workflowId, task);
        
        return workflowId;
    }

    analyzeTask(task) {
        const taskLower = task.toLowerCase();
        const tabs = [];
        
        // Price comparison
        if (taskLower.includes('compare') && (taskLower.includes('price') || taskLower.includes('product'))) {
            tabs.push(
                { url: 'https://www.amazon.com', purpose: 'Amazon prices' },
                { url: 'https://www.ebay.com', purpose: 'eBay prices' }
            );
        }
        // Flight/travel
        else if (taskLower.includes('flight') || taskLower.includes('travel')) {
            tabs.push(
                { url: 'https://www.google.com/travel/flights', purpose: 'Google Flights' },
                { url: 'https://www.kayak.com', purpose: 'Kayak comparison' }
            );
        }
        // Restaurant booking
        else if (taskLower.includes('restaurant') || taskLower.includes('reservation')) {
            tabs.push(
                { url: 'https://www.opentable.com', purpose: 'OpenTable reservations' },
                { url: 'https://www.yelp.com', purpose: 'Yelp reviews' }
            );
        }
        // Research
        else if (taskLower.includes('research')) {
            tabs.push(
                { url: 'https://www.google.com', purpose: 'Google search' },
                { url: 'https://scholar.google.com', purpose: 'Academic search' }
            );
        }
        // Default: single Google tab
        else {
            tabs.push({ url: 'https://www.google.com', purpose: 'General search' });
        }
        
        return tabs;
    }

    async createTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.create({ url: url, active: false }, (tab) => {
                this.activeTabs.set(tab.id, { url: url, created: Date.now() });
                resolve(tab);
            });
        });
    }

    async waitForTabLoad(tabId) {
        return new Promise((resolve) => {
            const listener = (id, changeInfo) => {
                if (id === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async executeWorkflow(workflowId, task) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return;
        
        workflow.status = 'executing';
        
        sendWorkflowUpdate({
            log: 'Coordinating actions across tabs...',
            logType: 'info',
            progress: 50
        });
        
        // Execute task on each tab
        const results = [];
        for (const tabId of workflow.tabs) {
            const connection = this.tabConnections.get(tabId);
            if (connection) {
                const result = await connection.executeTask(task);
                results.push({ tabId, result });
            }
        }
        
        // Aggregate results
        sendWorkflowUpdate({
            log: 'Workflow completed across all tabs',
            logType: 'success',
            progress: 100
        });
        
        workflow.status = 'completed';
        return results;
    }
}

// Simplified tab connection for multi-tab workflows
class TabConnection {
    constructor(tabId, apiKey) {
        this.tabId = tabId;
        this.apiKey = apiKey;
        this.ws = null;
    }

    async connect() {
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.sendSetup();
                resolve();
            };
            
            this.ws.onerror = reject;
        });
    }

    sendSetup() {
        const setup = {
            setup: {
                model: 'models/gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048
                }
            }
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(setup));
        }
    }

    async executeTask(task) {
        // Capture screenshot and send task
        const screenshot = await this.captureScreenshot();
        
        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        { text: task },
                        { inlineData: { mimeType: 'image/jpeg', data: screenshot.split(',')[1] } }
                    ]
                }],
                turnComplete: true
            }
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        
        return { success: true };
    }

    async captureScreenshot() {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'captureScreenshot'
            }, (response) => {
                resolve(response?.screenshot || '');
            });
        });
    }
}