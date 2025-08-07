// AI Brain System - Advanced Rule-Based Chrome Extension Controller
// Human-like reasoning + Browser automation translation

class AIBrainSystem {
    constructor() {
        this.apiKey = null;
        this.websocket = null;
        this.isConnected = false;
        this.activeTabId = null;
        
        // Advanced memory system
        this.memory = {
            shortTerm: {
                currentTask: null,
                currentPlan: null,
                currentStep: 0,
                recentActions: [],
                pageContext: {},
                lastError: null
            },
            longTerm: {
                userPreferences: {},
                learnedPatterns: {},
                successfulWorkflows: [],
                websiteKnowledge: {},
                taskHistory: []
            },
            episodic: {
                sessions: [],
                completedTasks: [],
                failures: []
            }
        };
        
        // Reasoning engine state
        this.reasoning = {
            role: null,
            humanPlan: null,
            browserPlan: null,
            confidence: 0,
            alternatives: []
        };
        
        // Chrome APIs state
        this.chromeAPIs = {
            tabs: { active: null, all: [] },
            windows: { current: null },
            downloads: { active: [] },
            bookmarks: { recent: [] },
            history: { recent: [] },
            cookies: {},
            alarms: {}
        };
        
        // Rule system
        this.rules = this.initializeRules();
        
        // Workflow states
        this.workflowState = 'idle'; // idle, planning, executing, evaluating
        
        this.messageBuffer = '';
    }

    initializeRules() {
        return {
            // Core behavioral rules
            core: {
                alwaysThinkFirst: true,
                explainReasoning: true,
                askForClarification: true,
                learnFromMistakes: true,
                respectUserPrivacy: true,
                neverAutoSubmitForms: true,
                alwaysVerifyActions: true
            },
            
            // Task execution rules
            execution: {
                maxRetriesPerAction: 3,
                waitBetweenActions: 1500,
                screenshotBeforeAction: true,
                verifyAfterAction: true,
                fallbackStrategies: true,
                parallelExploration: false
            },
            
            // Planning rules
            planning: {
                requireHumanPlan: true,
                maxStepsPerPlan: 10,
                considerAlternatives: true,
                estimateTimePerStep: true,
                identifyRisks: true
            },
            
            // Learning rules
            learning: {
                rememberSuccesses: true,
                analyzeFailures: true,
                adaptToWebsites: true,
                improveOverTime: true
            },
            
            // Safety rules
            safety: {
                neverEnterPasswords: true,
                neverMakePayments: true,
                warnBeforeDangerous: true,
                requireConfirmation: ['purchase', 'delete', 'submit']
            }
        };
    }

    async initialize() {
        console.log('🧠 Initializing AI Brain System');
        
        // Setup Chrome extension features
        await this.setupChromeAPIs();
        
        // Load saved memory
        await this.loadMemory();
        
        // Setup message listeners
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        // Setup Chrome API listeners
        this.setupChromeListeners();
        
        console.log('✅ AI Brain System initialized');
    }

    async setupChromeAPIs() {
        // Setup side panel
        try {
            await chrome.sidePanel.setOptions({
                path: 'advanced-ui.html',
                enabled: true
            });
            
            await chrome.sidePanel.setPanelBehavior({ 
                openPanelOnActionClick: true 
            });
        } catch (error) {
            console.error('Side panel setup error:', error);
        }
        
        // Setup keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
        
        // Setup alarms for scheduled tasks
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    setupChromeListeners() {
        // Tab events
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.onTabUpdated(tabId, changeInfo, tab);
        });
        
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.onTabActivated(activeInfo);
        });
        
        // Navigation events
        chrome.webNavigation.onCompleted.addListener((details) => {
            this.onNavigationCompleted(details);
        });
        
        // Download events
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.onDownloadChanged(downloadDelta);
        });
        
        // Context menu
        chrome.contextMenus.create({
            id: 'ai-assist',
            title: 'AI Assist with this',
            contexts: ['selection', 'link', 'image']
        });
        
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenu(info, tab);
        });
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('📨 Brain received:', request.action);
        
        switch (request.action) {
            case 'SET_API_KEY':
                await this.setApiKey(request.data.apiKey);
                sendResponse({ success: true });
                break;
                
            case 'START_TASK':
                const result = await this.startTask(request.data);
                sendResponse(result);
                break;
                
            case 'STOP':
                this.stop();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false });
        }
    }

    async startTask(data) {
        console.log('🎯 Starting task:', data.task);
        
        // Store task in memory
        this.memory.shortTerm.currentTask = data.task;
        this.memory.shortTerm.currentStep = 0;
        this.activeTabId = data.tabId;
        
        // Connect to Gemini if not connected
        if (!this.isConnected) {
            const connected = await this.connectToGemini();
            if (!connected) {
                return { success: false, error: 'Connection failed' };
            }
        }
        
        // Start the reasoning workflow
        this.workflowState = 'planning';
        await this.startReasoningWorkflow(data.task);
        
        return { success: true };
    }

    async startReasoningWorkflow(task) {
        console.log('🔄 Starting reasoning workflow');
        
        // Step 1: Assign role and think like a human
        const humanReasoning = await this.thinkLikeHuman(task);
        
        // Step 2: Create human-like plan
        const humanPlan = await this.createHumanPlan(humanReasoning);
        
        // Step 3: Translate to browser actions
        const browserPlan = await this.translateToBrowserActions(humanPlan);
        
        // Step 4: Execute with monitoring
        await this.executePlanWithMonitoring(browserPlan);
    }

    async thinkLikeHuman(task) {
        console.log('🤔 Thinking like a human...');
        
        const screenshot = await this.captureScreenshot();
        const pageContext = await this.analyzePageContext();
        
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
                            text: `${this.getHumanReasoningPrompt()}

TASK: ${task}

Current URL: ${pageContext.url}
Page Title: ${pageContext.title}

Think step by step like an expert human web user:
1. What is the user trying to achieve?
2. What would a human normally do?
3. What are the best websites/approaches?
4. What information needs to be compared?
5. What are potential issues to watch for?

Respond in this format:
{
  "role": "expert web researcher|shopper|information seeker|etc",
  "understanding": "What the user really wants",
  "human_approach": {
    "strategy": "How a human would approach this",
    "websites": ["List of websites to check"],
    "criteria": ["What to look for"],
    "comparison": ["What to compare"],
    "red_flags": ["What to avoid"]
  },
  "estimated_time": "How long this normally takes",
  "confidence": 0.0-1.0
}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
        
        // Wait for response
        return new Promise((resolve) => {
            this.pendingResponse = resolve;
        });
    }

    async createHumanPlan(humanReasoning) {
        console.log('📝 Creating human-like plan...');
        
        this.reasoning.role = humanReasoning.role;
        this.reasoning.humanPlan = humanReasoning;
        
        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{
                        text: `Based on your analysis as ${humanReasoning.role}, create a detailed step-by-step plan:

Understanding: ${humanReasoning.understanding}
Strategy: ${humanReasoning.human_approach.strategy}

Create a natural workflow that a human would follow:

{
  "plan": {
    "overview": "Brief description of the plan",
    "steps": [
      {
        "step": 1,
        "human_action": "What a human would do",
        "purpose": "Why this step is needed",
        "expected_result": "What should happen",
        "alternatives": ["Backup options if this fails"]
      }
    ],
    "success_criteria": "How we know we succeeded",
    "estimated_duration": "Total time estimate"
  }
}`
                    }]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
        
        return new Promise((resolve) => {
            this.pendingResponse = resolve;
        });
    }

    async translateToBrowserActions(humanPlan) {
        console.log('🔄 Translating to browser actions...');
        
        this.memory.shortTerm.currentPlan = humanPlan;
        
        const screenshot = await this.captureScreenshot();
        
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
                            text: `${this.getBrowserAutomationPrompt()}

HUMAN PLAN:
${JSON.stringify(humanPlan, null, 2)}

CURRENT STEP: ${this.memory.shortTerm.currentStep + 1}
HUMAN ACTION: ${humanPlan.plan.steps[this.memory.shortTerm.currentStep].human_action}

Translate this human action into specific browser automation:

{
  "thinking": "How to achieve this in the browser",
  "browser_action": {
    "type": "click|type|navigate|scroll|wait|tab|download|bookmark",
    "target": "Specific element or URL",
    "value": "Value if needed",
    "verification": "How to verify success"
  },
  "fallback": {
    "type": "Alternative action",
    "target": "Alternative target"
  }
}`
                        }
                    ]
                }],
                turnComplete: true
            }
        };

        this.websocket.send(JSON.stringify(message));
        
        return new Promise((resolve) => {
            this.pendingResponse = resolve;
        });
    }

    async executePlanWithMonitoring(browserPlan) {
        console.log('🚀 Executing plan with monitoring...');
        
        this.workflowState = 'executing';
        
        try {
            // Execute the browser action
            const result = await this.executeBrowserAction(browserPlan.browser_action);
            
            if (result.success) {
                // Record success
                this.recordSuccess(browserPlan.browser_action);
                
                // Move to next step
                this.memory.shortTerm.currentStep++;
                
                // Check if plan is complete
                if (this.memory.shortTerm.currentStep >= this.memory.shortTerm.currentPlan.plan.steps.length) {
                    await this.completePlan();
                } else {
                    // Continue with next step
                    await this.continueExecution();
                }
            } else {
                // Try fallback
                if (browserPlan.fallback) {
                    const fallbackResult = await this.executeBrowserAction(browserPlan.fallback);
                    if (fallbackResult.success) {
                        await this.continueExecution();
                    } else {
                        await this.handleFailure(result.error);
                    }
                } else {
                    await this.handleFailure(result.error);
                }
            }
        } catch (error) {
            await this.handleFailure(error);
        }
    }

    async executeBrowserAction(action) {
        console.log('⚡ Executing browser action:', action);
        
        switch (action.type) {
            case 'navigate':
                return await this.navigateToUrl(action.target);
                
            case 'click':
                return await this.clickElement(action.target);
                
            case 'type':
                return await this.typeText(action.target, action.value);
                
            case 'tab':
                return await this.manageTabs(action);
                
            case 'download':
                return await this.handleDownload(action);
                
            case 'bookmark':
                return await this.manageBookmarks(action);
                
            case 'scroll':
                return await this.scrollPage(action);
                
            case 'wait':
                return await this.waitFor(action);
                
            default:
                return { success: false, error: 'Unknown action type' };
        }
    }

    async navigateToUrl(url) {
        try {
            await chrome.tabs.update(this.activeTabId, { url });
            await this.waitForPageLoad();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async clickElement(selector) {
        try {
            await this.ensureContentScript();
            const response = await chrome.tabs.sendMessage(this.activeTabId, {
                action: 'CLICK',
                selector
            });
            return response;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async manageTabs(action) {
        try {
            switch (action.subtype) {
                case 'new':
                    const tab = await chrome.tabs.create({ url: action.target });
                    this.chromeAPIs.tabs.all.push(tab);
                    return { success: true, tabId: tab.id };
                    
                case 'switch':
                    await chrome.tabs.update(action.target, { active: true });
                    return { success: true };
                    
                case 'close':
                    await chrome.tabs.remove(action.target);
                    return { success: true };
                    
                default:
                    return { success: false, error: 'Unknown tab action' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async continueExecution() {
        // Get next browser action
        const nextAction = await this.translateToBrowserActions(this.memory.shortTerm.currentPlan);
        await this.executePlanWithMonitoring(nextAction);
    }

    async completePlan() {
        console.log('✅ Plan completed successfully!');
        
        // Save successful workflow
        this.memory.longTerm.successfulWorkflows.push({
            task: this.memory.shortTerm.currentTask,
            plan: this.memory.shortTerm.currentPlan,
            timestamp: Date.now()
        });
        
        // Save to storage
        await this.saveMemory();
        
        // Notify user
        this.sendNotification('success', '✅ Task completed successfully!');
        
        // Reset state
        this.workflowState = 'idle';
        this.memory.shortTerm.currentTask = null;
        this.memory.shortTerm.currentPlan = null;
        this.memory.shortTerm.currentStep = 0;
    }

    async handleFailure(error) {
        console.error('❌ Execution failed:', error);
        
        // Record failure
        this.memory.episodic.failures.push({
            task: this.memory.shortTerm.currentTask,
            step: this.memory.shortTerm.currentStep,
            error: error,
            timestamp: Date.now()
        });
        
        // Try to recover
        await this.attemptRecovery();
    }

    async attemptRecovery() {
        console.log('🔧 Attempting recovery...');
        
        const screenshot = await this.captureScreenshot();
        
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
                            text: `Recovery needed!

Original task: ${this.memory.shortTerm.currentTask}
Current step: ${this.memory.shortTerm.currentStep + 1}
Failed action: ${JSON.stringify(this.memory.shortTerm.lastError)}

Analyze the situation and provide recovery action:
{
  "analysis": "What went wrong",
  "recovery_action": {
    "type": "click|type|navigate|wait|retry|skip|abort",
    "target": "Specific element or action",
    "reason": "Why this will work"
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

    // Chrome API helper methods
    async captureScreenshot() {
        try {
            return await chrome.tabs.captureVisibleTab(null, {
                format: 'jpeg',
                quality: 90
            });
        } catch (error) {
            console.error('Screenshot error:', error);
            return null;
        }
    }

    async analyzePageContext() {
        const tab = await chrome.tabs.get(this.activeTabId);
        
        // Get detailed page info
        const pageInfo = await chrome.tabs.sendMessage(this.activeTabId, {
            action: 'GET_PAGE_INFO'
        }).catch(() => ({}));
        
        return {
            url: tab.url,
            title: tab.title,
            ...pageInfo
        };
    }

    async waitForPageLoad() {
        return new Promise((resolve) => {
            const listener = (tabId, changeInfo) => {
                if (tabId === this.activeTabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 10000);
        });
    }

    async ensureContentScript() {
        try {
            await chrome.tabs.sendMessage(this.activeTabId, { action: 'PING' });
        } catch {
            await chrome.scripting.executeScript({
                target: { tabId: this.activeTabId },
                files: ['intelligent-controller.js']
            });
            await this.sleep(500);
        }
    }

    // Memory management
    async loadMemory() {
        const stored = await chrome.storage.local.get(['aiMemory']);
        if (stored.aiMemory) {
            this.memory.longTerm = stored.aiMemory.longTerm || this.memory.longTerm;
            this.memory.episodic = stored.aiMemory.episodic || this.memory.episodic;
        }
    }

    async saveMemory() {
        await chrome.storage.local.set({
            aiMemory: {
                longTerm: this.memory.longTerm,
                episodic: this.memory.episodic
            }
        });
    }

    recordSuccess(action) {
        // Learn from successful actions
        const url = new URL(this.memory.shortTerm.pageContext.url || 'http://unknown');
        const domain = url.hostname;
        
        if (!this.memory.longTerm.websiteKnowledge[domain]) {
            this.memory.longTerm.websiteKnowledge[domain] = {
                successfulActions: [],
                elements: {}
            };
        }
        
        this.memory.longTerm.websiteKnowledge[domain].successfulActions.push({
            action,
            timestamp: Date.now()
        });
    }

    // Event handlers
    onTabUpdated(tabId, changeInfo, tab) {
        if (tabId === this.activeTabId && changeInfo.status === 'complete') {
            console.log('Tab loaded:', tab.url);
            this.memory.shortTerm.pageContext = { url: tab.url, title: tab.title };
        }
    }

    onTabActivated(activeInfo) {
        this.chromeAPIs.tabs.active = activeInfo.tabId;
    }

    onNavigationCompleted(details) {
        if (details.tabId === this.activeTabId) {
            console.log('Navigation completed:', details.url);
        }
    }

    onDownloadChanged(downloadDelta) {
        console.log('Download changed:', downloadDelta);
        this.chromeAPIs.downloads.active.push(downloadDelta);
    }

    handleContextMenu(info, tab) {
        console.log('Context menu clicked:', info);
        // Start task based on context
        this.startTask({
            task: `Help with: ${info.selectionText || info.linkUrl || 'this'}`,
            tabId: tab.id
        });
    }

    handleCommand(command) {
        console.log('Keyboard command:', command);
        // Handle keyboard shortcuts
    }

    handleAlarm(alarm) {
        console.log('Alarm triggered:', alarm);
        // Handle scheduled tasks
    }

    // Gemini connection
    async connectToGemini() {
        return new Promise((resolve) => {
            try {
                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                
                this.websocket = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    if (!this.isConnected) {
                        this.websocket.close();
                        resolve(false);
                    }
                }, 15000);

                this.websocket.onopen = () => {
                    const setup = {
                        setup: {
                            model: "models/gemini-2.0-flash-exp",
                            generationConfig: {
                                responseModalities: ["TEXT"],
                                temperature: 0.3,
                                topP: 0.95,
                                maxOutputTokens: 4096
                            }
                        }
                    };

                    this.websocket.send(JSON.stringify(setup));
                };

                this.websocket.onmessage = async (event) => {
                    let data;
                    if (event.data instanceof Blob) {
                        const text = await event.data.text();
                        data = JSON.parse(text);
                    } else {
                        data = JSON.parse(event.data);
                    }

                    if (data.setupComplete) {
                        clearTimeout(timeout);
                        this.isConnected = true;
                        resolve(true);
                        return;
                    }

                    if (data.serverContent) {
                        await this.handleGeminiResponse(data);
                    }
                };

                this.websocket.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };

            } catch (error) {
                console.error('Connection error:', error);
                resolve(false);
            }
        });
    }

    async handleGeminiResponse(data) {
        if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
                if (part.text) {
                    this.messageBuffer += part.text;
                }
            }
        }

        if (data.serverContent?.turnComplete) {
            if (this.messageBuffer && this.pendingResponse) {
                try {
                    const response = JSON.parse(this.messageBuffer);
                    this.pendingResponse(response);
                    this.pendingResponse = null;
                } catch (error) {
                    console.error('Failed to parse response:', error);
                }
                this.messageBuffer = '';
            }
        }
    }

    getHumanReasoningPrompt() {
        return `You are an expert human web user. Think naturally about how to accomplish tasks.

${JSON.stringify(this.rules, null, 2)}

MEMORY:
- Previous successful tasks: ${this.memory.episodic.completedTasks.length}
- Known websites: ${Object.keys(this.memory.longTerm.websiteKnowledge).join(', ')}
- User preferences: ${JSON.stringify(this.memory.longTerm.userPreferences)}

Think step by step like a real person would.`;
    }

    getBrowserAutomationPrompt() {
        return `You are a Chrome extension with full browser control capabilities.

Available APIs:
- DOM manipulation (click, type, scroll)
- Tab management (create, switch, close)
- Navigation control
- Downloads management
- Bookmarks
- History access
- Cookie management
- Screenshot capture
- Storage

Current browser state:
- Active tab: ${this.activeTabId}
- Open tabs: ${this.chromeAPIs.tabs.all.length}
- Current URL: ${this.memory.shortTerm.pageContext.url}

Translate human actions into precise browser automation commands.`;
    }

    sendNotification(type, message) {
        chrome.runtime.sendMessage({
            type: 'notification',
            data: { type, message }
        }).catch(() => {});
    }

    async setApiKey(apiKey) {
        this.apiKey = apiKey;
        await chrome.storage.local.set({ geminiApiKey: apiKey });
    }

    stop() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.isConnected = false;
        this.workflowState = 'idle';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the AI Brain System
const aiBrain = new AIBrainSystem();
aiBrain.initialize().then(() => {
    console.log('🧠 AI Brain System ready');
}).catch(error => {
    console.error('Failed to initialize AI Brain:', error);
});