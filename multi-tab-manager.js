// Multi-Tab Manager for Advanced Automation
// Inspired by Perplexity Comet's capabilities

class MultiTabManager {
    constructor() {
        this.activeTabs = new Map(); // tabId -> tab info
        this.workflows = new Map(); // workflowId -> workflow state
        this.sessionMemory = new Map(); // tabId -> context
        this.globalContext = {
            userPreferences: {},
            history: [],
            activeWorkflows: []
        };
        
        // WebSocket connections per tab
        this.tabConnections = new Map(); // tabId -> WebSocket
        
        // Initialize listeners
        this.initializeListeners();
    }

    initializeListeners() {
        // Tab events
        chrome.tabs.onCreated.addListener((tab) => this.handleTabCreated(tab));
        chrome.tabs.onRemoved.addListener((tabId) => this.handleTabRemoved(tabId));
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => 
            this.handleTabUpdated(tabId, changeInfo, tab));
        
        // Navigation events
        chrome.webNavigation.onCompleted.addListener((details) => 
            this.handleNavigationCompleted(details));
        
        // Context menu integration
        this.setupContextMenus();
    }

    // Create and manage multiple tabs for complex workflows
    async createWorkflow(task, apiKey) {
        const workflowId = this.generateWorkflowId();
        const workflow = {
            id: workflowId,
            task: task,
            status: 'initializing',
            tabs: [],
            context: {},
            steps: [],
            startTime: Date.now()
        };
        
        this.workflows.set(workflowId, workflow);
        
        // Parse task to determine required tabs
        const requiredTabs = await this.analyzeTaskRequirements(task);
        
        // Create tabs for workflow
        for (const tabConfig of requiredTabs) {
            const tab = await this.createTab(tabConfig.url, workflowId);
            workflow.tabs.push(tab.id);
            
            // Establish WebSocket for this tab
            await this.establishTabConnection(tab.id, apiKey);
        }
        
        // Start workflow execution
        this.executeWorkflow(workflowId, apiKey);
        
        return workflowId;
    }

    async analyzeTaskRequirements(task) {
        // Intelligent task analysis to determine required tabs
        const taskLower = task.toLowerCase();
        const requiredTabs = [];
        
        // Shopping tasks
        if (taskLower.includes('compare') && taskLower.includes('price')) {
            requiredTabs.push(
                { url: 'https://www.amazon.com', purpose: 'price_comparison' },
                { url: 'https://www.ebay.com', purpose: 'price_comparison' },
                { url: 'https://www.walmart.com', purpose: 'price_comparison' }
            );
        }
        
        // Travel planning
        if (taskLower.includes('flight') || taskLower.includes('travel')) {
            requiredTabs.push(
                { url: 'https://www.google.com/travel/flights', purpose: 'flight_search' },
                { url: 'https://www.kayak.com', purpose: 'price_comparison' },
                { url: 'https://www.booking.com', purpose: 'hotel_search' }
            );
        }
        
        // Research tasks
        if (taskLower.includes('research') || taskLower.includes('learn')) {
            requiredTabs.push(
                { url: 'https://scholar.google.com', purpose: 'academic_search' },
                { url: 'https://www.wikipedia.org', purpose: 'general_info' },
                { url: 'https://www.youtube.com', purpose: 'video_resources' }
            );
        }
        
        // Restaurant/food tasks
        if (taskLower.includes('restaurant') || taskLower.includes('food')) {
            requiredTabs.push(
                { url: 'https://www.opentable.com', purpose: 'reservation' },
                { url: 'https://www.yelp.com', purpose: 'reviews' },
                { url: 'https://maps.google.com', purpose: 'location' }
            );
        }
        
        // Default: single tab with Google
        if (requiredTabs.length === 0) {
            requiredTabs.push({ url: 'https://www.google.com', purpose: 'general_search' });
        }
        
        return requiredTabs;
    }

    async createTab(url, workflowId) {
        return new Promise((resolve) => {
            chrome.tabs.create({ url: url, active: false }, (tab) => {
                this.activeTabs.set(tab.id, {
                    workflowId: workflowId,
                    purpose: 'workflow_tab',
                    created: Date.now(),
                    history: [url]
                });
                resolve(tab);
            });
        });
    }

    async establishTabConnection(tabId, apiKey) {
        // Create WebSocket connection for this specific tab
        const connection = new TabWebSocketConnection(tabId, apiKey);
        await connection.connect();
        this.tabConnections.set(tabId, connection);
        return connection;
    }

    async executeWorkflow(workflowId, apiKey) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return;
        
        workflow.status = 'executing';
        
        // Coordinate actions across multiple tabs
        const coordinator = new WorkflowCoordinator(workflow, this);
        await coordinator.execute(apiKey);
    }

    // Context sharing across tabs
    shareContextAcrossTabs(sourceTabId, data) {
        const sourceWorkflow = this.getWorkflowByTabId(sourceTabId);
        if (!sourceWorkflow) return;
        
        // Share context with all tabs in the same workflow
        for (const tabId of sourceWorkflow.tabs) {
            if (tabId !== sourceTabId) {
                this.updateTabContext(tabId, data);
            }
        }
    }

    updateTabContext(tabId, data) {
        const context = this.sessionMemory.get(tabId) || {};
        Object.assign(context, data);
        this.sessionMemory.set(tabId, context);
        
        // Notify tab of context update
        chrome.tabs.sendMessage(tabId, {
            action: 'contextUpdate',
            data: data
        });
    }

    // Advanced features inspired by Comet
    async performCrossTabAction(action) {
        switch (action.type) {
            case 'compare_prices':
                return await this.comparePricesAcrossTabs(action.product);
            
            case 'aggregate_results':
                return await this.aggregateSearchResults(action.query);
            
            case 'book_appointment':
                return await this.bookAppointment(action.details);
            
            case 'send_email':
                return await this.composeAndSendEmail(action.content);
            
            case 'summarize_tabs':
                return await this.summarizeAllTabs();
            
            default:
                return null;
        }
    }

    async comparePricesAcrossTabs(product) {
        const results = [];
        
        for (const [tabId, tabInfo] of this.activeTabs) {
            if (tabInfo.purpose === 'price_comparison') {
                const connection = this.tabConnections.get(tabId);
                if (connection) {
                    const price = await connection.searchAndExtractPrice(product);
                    results.push({ tabId, url: tabInfo.history[0], price });
                }
            }
        }
        
        return results.sort((a, b) => a.price - b.price);
    }

    async aggregateSearchResults(query) {
        const aggregatedResults = [];
        
        for (const [tabId, connection] of this.tabConnections) {
            const results = await connection.performSearch(query);
            aggregatedResults.push(...results);
        }
        
        // Deduplicate and rank results
        return this.rankAndDeduplicate(aggregatedResults);
    }

    async bookAppointment(details) {
        // Find appropriate tab (e.g., OpenTable for restaurants)
        const bookingTab = Array.from(this.activeTabs.entries())
            .find(([_, info]) => info.purpose === 'reservation');
        
        if (bookingTab) {
            const [tabId, _] = bookingTab;
            const connection = this.tabConnections.get(tabId);
            return await connection.executeBooking(details);
        }
        
        return null;
    }

    async composeAndSendEmail(content) {
        // Create Gmail tab if not exists
        let gmailTab = Array.from(this.activeTabs.entries())
            .find(([_, info]) => info.history.includes('mail.google.com'));
        
        if (!gmailTab) {
            const tab = await this.createTab('https://mail.google.com', 'email_workflow');
            gmailTab = [tab.id, this.activeTabs.get(tab.id)];
        }
        
        const [tabId, _] = gmailTab;
        const connection = this.tabConnections.get(tabId);
        return await connection.composeEmail(content);
    }

    async summarizeAllTabs() {
        const summaries = [];
        
        for (const [tabId, connection] of this.tabConnections) {
            const summary = await connection.extractPageSummary();
            const tabInfo = this.activeTabs.get(tabId);
            summaries.push({
                tabId,
                url: tabInfo.history[tabInfo.history.length - 1],
                summary
            });
        }
        
        return summaries;
    }

    // Helper methods
    getWorkflowByTabId(tabId) {
        const tabInfo = this.activeTabs.get(tabId);
        if (!tabInfo) return null;
        return this.workflows.get(tabInfo.workflowId);
    }

    generateWorkflowId() {
        return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    rankAndDeduplicate(results) {
        // Implement intelligent ranking and deduplication
        const seen = new Set();
        return results.filter(result => {
            const key = result.url || result.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    }

    // Tab lifecycle handlers
    handleTabCreated(tab) {
        console.log('Tab created:', tab.id);
    }

    handleTabRemoved(tabId) {
        // Clean up resources
        this.activeTabs.delete(tabId);
        this.sessionMemory.delete(tabId);
        
        const connection = this.tabConnections.get(tabId);
        if (connection) {
            connection.disconnect();
            this.tabConnections.delete(tabId);
        }
    }

    handleTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete') {
            const tabInfo = this.activeTabs.get(tabId);
            if (tabInfo) {
                tabInfo.history.push(tab.url);
                
                // Notify workflow coordinator
                const workflow = this.getWorkflowByTabId(tabId);
                if (workflow) {
                    this.notifyWorkflowUpdate(workflow.id, {
                        type: 'navigation',
                        tabId: tabId,
                        url: tab.url
                    });
                }
            }
        }
    }

    handleNavigationCompleted(details) {
        if (details.frameId === 0) {
            // Main frame navigation completed
            const connection = this.tabConnections.get(details.tabId);
            if (connection) {
                connection.handleNavigationComplete();
            }
        }
    }

    notifyWorkflowUpdate(workflowId, update) {
        chrome.runtime.sendMessage({
            action: 'workflowUpdate',
            workflowId: workflowId,
            update: update
        });
    }

    // Context menu setup
    setupContextMenus() {
        chrome.contextMenus.create({
            id: 'aiAssistant',
            title: 'AI Assistant',
            contexts: ['all']
        });
        
        chrome.contextMenus.create({
            id: 'summarizePage',
            title: 'Summarize this page',
            parentId: 'aiAssistant',
            contexts: ['page']
        });
        
        chrome.contextMenus.create({
            id: 'compareAcrossTabs',
            title: 'Compare across tabs',
            parentId: 'aiAssistant',
            contexts: ['selection']
        });
        
        chrome.contextMenus.create({
            id: 'bookmarkWorkflow',
            title: 'Save workflow',
            parentId: 'aiAssistant',
            contexts: ['all']
        });
    }
}

// Tab-specific WebSocket connection
class TabWebSocketConnection {
    constructor(tabId, apiKey) {
        this.tabId = tabId;
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];
    }

    async connect() {
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.sendSetup();
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.ws.onerror = (error) => {
                console.error(`Tab ${this.tabId} WebSocket error:`, error);
                reject(error);
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
            };
        });
    }

    sendSetup() {
        const setup = {
            setup: {
                model: 'models/gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json'
                },
                systemInstruction: {
                    parts: [{
                        text: `You are an intelligent automation assistant for tab ${this.tabId}.
                        You can perform various tasks including search, data extraction, form filling, and navigation.
                        Always respond with structured JSON for automation actions.`
                    }]
                }
            }
        };
        
        this.send(setup);
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Process message based on tab context
            this.processTabSpecificResponse(message);
        } catch (error) {
            console.error(`Tab ${this.tabId} message error:`, error);
        }
    }

    processTabSpecificResponse(message) {
        // Handle responses specific to this tab's context
        if (message.serverContent) {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'executeFromAI',
                data: message.serverContent
            });
        }
    }

    async searchAndExtractPrice(product) {
        // Tab-specific price extraction logic
        const screenshot = await this.captureTabScreenshot();
        
        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [
                        { text: `Search for "${product}" and extract the price. Return as JSON: {price: number, currency: string}` },
                        { inlineData: { mimeType: 'image/jpeg', data: screenshot } }
                    ]
                }],
                turnComplete: true
            }
        };
        
        this.send(message);
        
        // Wait for response (simplified - should use promises)
        return new Promise((resolve) => {
            setTimeout(() => resolve({ price: 0, currency: 'USD' }), 2000);
        });
    }

    async performSearch(query) {
        // Execute search on this tab
        return [];
    }

    async executeBooking(details) {
        // Execute booking workflow on this tab
        return { success: false };
    }

    async composeEmail(content) {
        // Compose email on Gmail tab
        return { success: false };
    }

    async extractPageSummary() {
        // Extract summary of current page
        return 'Page summary';
    }

    async captureTabScreenshot() {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(this.tabId, {
                action: 'captureScreenshot'
            }, (response) => {
                resolve(response?.screenshot || '');
            });
        });
    }

    handleNavigationComplete() {
        // Re-establish context after navigation
        this.sendSetup();
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Workflow coordinator
class WorkflowCoordinator {
    constructor(workflow, manager) {
        this.workflow = workflow;
        this.manager = manager;
        this.currentStep = 0;
    }

    async execute(apiKey) {
        // Intelligent workflow execution across multiple tabs
        console.log(`Executing workflow ${this.workflow.id}: ${this.workflow.task}`);
        
        // Example: Price comparison workflow
        if (this.workflow.task.includes('compare')) {
            await this.executePriceComparison();
        }
        
        // Add more workflow patterns
    }

    async executePriceComparison() {
        const results = await this.manager.comparePricesAcrossTabs(this.workflow.task);
        
        // Report results
        chrome.runtime.sendMessage({
            action: 'workflowResult',
            workflowId: this.workflow.id,
            results: results
        });
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiTabManager;
}