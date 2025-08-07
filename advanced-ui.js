// Advanced UI Controller - Connects UI with AI Brain System
// Handles all UI interactions and state management

class AdvancedUIController {
    constructor() {
        this.apiKey = null;
        this.currentTab = 'control';
        this.isConnected = false;
        this.workflowSteps = [];
        this.currentStep = 0;
        this.settings = {};
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    async initialize() {
        console.log('🎨 Initializing Advanced UI');
        
        // Load saved API key
        await this.loadApiKey();
        
        // Setup tab navigation
        this.setupTabs();
        
        // Setup control panel
        this.setupControlPanel();
        
        // Setup settings
        this.setupSettings();
        
        // Listen for messages from background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request);
        });
        
        // Check connection status
        this.checkConnectionStatus();
        
        console.log('✅ Advanced UI initialized');
    }
    
    async loadApiKey() {
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.apiKey = result.geminiApiKey;
            document.getElementById('apiKey').value = result.geminiApiKey;
            document.getElementById('apiKey').style.backgroundColor = '#f0fdf4';
        }
    }
    
    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active class to clicked tab
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                document.getElementById(tabName).classList.add('active');
                this.currentTab = tabName;
                
                // Load tab-specific content
                this.loadTabContent(tabName);
            });
        });
    }
    
    setupControlPanel() {
        // API Key Save
        document.getElementById('saveApiKey').addEventListener('click', async () => {
            const apiKey = document.getElementById('apiKey').value.trim();
            if (!apiKey) {
                this.showMessage('error', 'Please enter an API key');
                return;
            }
            
            // Send to background
            const response = await chrome.runtime.sendMessage({
                action: 'SET_API_KEY',
                data: { apiKey }
            });
            
            if (response?.success) {
                this.apiKey = apiKey;
                document.getElementById('apiKey').style.backgroundColor = '#f0fdf4';
                this.showMessage('success', '✅ API Key saved successfully');
                
                // Try to connect
                setTimeout(() => this.checkConnectionStatus(), 500);
            }
        });
        
        // Task Input
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startTask();
            }
        });
        
        // Start Button
        document.getElementById('startTask').addEventListener('click', () => {
            this.startTask();
        });
    }
    
    setupSettings() {
        // Toggle switches
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                const setting = toggle.dataset.setting;
                const value = toggle.classList.contains('active');
                this.settings[setting] = value;
                
                // Save settings
                chrome.storage.local.set({ uiSettings: this.settings });
            });
        });
        
        // Load saved settings
        chrome.storage.local.get(['uiSettings']).then(result => {
            if (result.uiSettings) {
                this.settings = result.uiSettings;
                for (const [key, value] of Object.entries(this.settings)) {
                    const toggle = document.querySelector(`[data-setting="${key}"]`);
                    if (toggle) {
                        if (value) {
                            toggle.classList.add('active');
                        } else {
                            toggle.classList.remove('active');
                        }
                    }
                }
            }
        });
    }
    
    async startTask() {
        const task = document.getElementById('taskInput').value.trim();
        if (!task) {
            this.showMessage('error', 'Please enter a task');
            return;
        }
        
        if (!this.apiKey) {
            this.showMessage('error', 'Please set your API key first');
            return;
        }
        
        // Add to chat
        this.addChatMessage('human', task);
        document.getElementById('taskInput').value = '';
        
        // Show thinking indicator
        this.addChatMessage('ai', '🤔 Thinking...', true);
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send to background
        const response = await chrome.runtime.sendMessage({
            action: 'START_TASK',
            data: {
                task,
                tabId: tab.id
            }
        });
        
        if (!response?.success) {
            this.removelastAIMessage();
            this.addChatMessage('ai', '❌ Failed to start task: ' + (response?.error || 'Unknown error'));
        }
    }
    
    handleMessage(request) {
        console.log('UI received message:', request.type);
        
        switch (request.type) {
            case 'notification':
                this.handleNotification(request.data);
                break;
                
            case 'workflow_update':
                this.updateWorkflow(request.data);
                break;
                
            case 'memory_update':
                this.updateMemory(request.data);
                break;
                
            case 'status_update':
                this.updateStatus(request.data);
                break;
        }
    }
    
    handleNotification(data) {
        switch (data.type) {
            case 'status':
                this.updateConnectionStatus(data.message);
                break;
                
            case 'message':
                this.removelastAIMessage();
                this.addChatMessage('ai', data.message);
                break;
                
            case 'error':
                this.showMessage('error', data.message);
                break;
                
            case 'success':
                this.showMessage('success', data.message);
                break;
                
            case 'action':
                this.showAction(data.message);
                break;
        }
    }
    
    updateConnectionStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (status.includes('Connected') || status.includes('✅')) {
            indicator.classList.remove('disconnected');
            indicator.style.background = '#4ade80';
            statusText.textContent = 'Connected';
            this.isConnected = true;
        } else if (status.includes('Connecting')) {
            indicator.style.background = '#fbbf24';
            statusText.textContent = 'Connecting...';
        } else {
            indicator.classList.add('disconnected');
            indicator.style.background = '#94a3b8';
            statusText.textContent = 'Not connected';
            this.isConnected = false;
        }
    }
    
    updateWorkflow(data) {
        const workflowSteps = document.getElementById('workflowSteps');
        const workflowStatus = document.getElementById('workflowStatus');
        const workflowState = document.getElementById('workflowState');
        
        // Update workflow state
        if (data.state) {
            workflowState.textContent = `• ${data.state}`;
            
            // Update status badge
            if (data.state === 'planning') {
                workflowStatus.className = 'workflow-status planning';
                workflowStatus.textContent = 'Planning';
            } else if (data.state === 'executing') {
                workflowStatus.className = 'workflow-status executing';
                workflowStatus.textContent = 'Executing';
            } else if (data.state === 'complete') {
                workflowStatus.className = 'workflow-status complete';
                workflowStatus.textContent = 'Complete';
            }
        }
        
        // Update steps if provided
        if (data.steps) {
            this.workflowSteps = data.steps;
            this.currentStep = data.currentStep || 0;
            this.renderWorkflowSteps();
        }
        
        // Update current step
        if (data.currentStep !== undefined) {
            this.currentStep = data.currentStep;
            this.updateCurrentStep();
        }
    }
    
    renderWorkflowSteps() {
        const container = document.getElementById('workflowSteps');
        container.innerHTML = '';
        
        this.workflowSteps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.className = 'workflow-step';
            
            if (index === this.currentStep) {
                stepEl.classList.add('active');
            } else if (index < this.currentStep) {
                stepEl.classList.add('complete');
            }
            
            stepEl.innerHTML = `
                <div class="step-number ${index === this.currentStep ? 'active' : index < this.currentStep ? 'complete' : ''}">
                    ${index < this.currentStep ? '✓' : index + 1}
                </div>
                <div class="step-content">
                    <div class="step-title">${step.title || step.human_action || 'Step ' + (index + 1)}</div>
                    <div class="step-description">${step.description || step.purpose || ''}</div>
                </div>
            `;
            
            container.appendChild(stepEl);
        });
    }
    
    updateCurrentStep() {
        document.querySelectorAll('.workflow-step').forEach((step, index) => {
            step.classList.remove('active', 'complete');
            const number = step.querySelector('.step-number');
            
            if (index === this.currentStep) {
                step.classList.add('active');
                number.classList.add('active');
                number.classList.remove('complete');
                number.textContent = index + 1;
            } else if (index < this.currentStep) {
                step.classList.add('complete');
                number.classList.remove('active');
                number.classList.add('complete');
                number.textContent = '✓';
            } else {
                number.classList.remove('active', 'complete');
                number.textContent = index + 1;
            }
        });
    }
    
    updateMemory(data) {
        if (data.recentTasks) {
            const list = document.getElementById('recentTasks');
            list.innerHTML = data.recentTasks.map(task => 
                `<li>${task}</li>`
            ).join('') || '<li>No recent tasks</li>';
        }
        
        if (data.knownWebsites) {
            const list = document.getElementById('knownWebsites');
            list.innerHTML = data.knownWebsites.map(site => 
                `<li>${site}</li>`
            ).join('') || '<li>No websites learned yet</li>';
        }
        
        if (data.successfulPatterns) {
            const list = document.getElementById('successfulPatterns');
            list.innerHTML = data.successfulPatterns.map(pattern => 
                `<li>${pattern}</li>`
            ).join('') || '<li>No patterns learned yet</li>';
        }
        
        if (data.statistics) {
            document.getElementById('statistics').innerHTML = `
                Tasks completed: ${data.statistics.completed || 0}<br>
                Success rate: ${data.statistics.successRate || 0}%<br>
                Time saved: ${data.statistics.timeSaved || 0} min
            `;
        }
    }
    
    addChatMessage(type, message, isThinking = false) {
        const chatMessages = document.getElementById('chatMessages');
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        
        const avatar = type === 'human' ? '👤' : '🤖';
        
        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content ${isThinking ? 'thinking' : ''}">${message}</div>
        `;
        
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    removelastAIMessage() {
        const messages = document.querySelectorAll('.message.ai');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.querySelector('.thinking')) {
            lastMessage.remove();
        }
    }
    
    showMessage(type, message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    showAction(message) {
        // Show action in a subtle way
        const actionBar = document.createElement('div');
        actionBar.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            border-radius: 20px;
            font-size: 12px;
            z-index: 9999;
        `;
        actionBar.textContent = message;
        
        document.body.appendChild(actionBar);
        
        setTimeout(() => {
            actionBar.style.opacity = '0';
            actionBar.style.transition = 'opacity 0.3s';
            setTimeout(() => actionBar.remove(), 300);
        }, 2000);
    }
    
    async checkConnectionStatus() {
        // Check if connected to AI Brain
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'CHECK_STATUS'
            });
            
            if (response?.connected) {
                this.updateConnectionStatus('✅ Connected');
            } else {
                this.updateConnectionStatus('Not connected');
            }
        } catch (error) {
            this.updateConnectionStatus('Not connected');
        }
    }
    
    loadTabContent(tabName) {
        // Load specific content based on tab
        if (tabName === 'memory') {
            // Request memory update from background
            chrome.runtime.sendMessage({
                action: 'GET_MEMORY'
            });
        } else if (tabName === 'workflow') {
            // Request workflow update
            chrome.runtime.sendMessage({
                action: 'GET_WORKFLOW'
            });
        }
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize controller
const uiController = new AdvancedUIController();
console.log('🎯 Advanced UI Controller loaded');