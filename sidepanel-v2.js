// Side Panel UI Controller

class UIController {
    constructor() {
        this.selectedMode = null;
        this.isRunning = false;
        
        this.elements = {
            apiKey: document.getElementById('apiKey'),
            taskInput: document.getElementById('taskInput'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            logs: document.getElementById('logs'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            modeText: document.getElementById('modeText'),
            modeCards: document.querySelectorAll('.mode-card')
        };
        
        this.initialize();
    }
    
    initialize() {
        // Load saved API key
        this.loadApiKey();
        
        // Mode selection
        this.elements.modeCards.forEach(card => {
            card.addEventListener('click', () => this.selectMode(card.dataset.mode));
        });
        
        // Start/Stop buttons
        this.elements.startBtn.addEventListener('click', () => this.startAutomation());
        this.elements.stopBtn.addEventListener('click', () => this.stopAutomation());
        
        // Save API key on change
        this.elements.apiKey.addEventListener('change', () => this.saveApiKey());
        
        // Listen for messages from background
        chrome.runtime.onMessage.addListener((message) => this.handleMessage(message));
        
        // Select default mode
        this.selectMode('simple');
        
        this.log('AI Browser Automation ready', 'success');
    }
    
    loadApiKey() {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            if (result.geminiApiKey) {
                this.elements.apiKey.value = result.geminiApiKey;
                this.sendToBackground('SET_API_KEY', { apiKey: result.geminiApiKey });
            }
        });
    }
    
    saveApiKey() {
        const apiKey = this.elements.apiKey.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey });
            this.sendToBackground('SET_API_KEY', { apiKey });
            this.log('API key saved', 'success');
        }
    }
    
    selectMode(mode) {
        this.selectedMode = mode;
        
        // Update UI
        this.elements.modeCards.forEach(card => {
            card.classList.toggle('active', card.dataset.mode === mode);
        });
        
        this.elements.modeText.textContent = this.getModeDescription(mode);
        
        // Update placeholder based on mode
        this.updateTaskPlaceholder(mode);
    }
    
    getModeDescription(mode) {
        const descriptions = {
            'simple': 'Simple Mode - One-shot automation',
            'stream': 'Stream Mode - Real-time with feedback',
            'multi': 'Multi-Tab Mode - Cross-tab coordination',
            'assistant': 'Assistant Mode - Always-on helper'
        };
        return descriptions[mode] || 'No mode selected';
    }
    
    updateTaskPlaceholder(mode) {
        const placeholders = {
            'simple': 'Example: Search for coffee shops near me',
            'stream': 'Example: Help me fill out this complex form',
            'multi': 'Example: Compare iPhone prices across Amazon, eBay, and Best Buy',
            'assistant': 'Example: Watch this page and alert me when the price drops'
        };
        
        this.elements.taskInput.placeholder = placeholders[mode] || this.elements.taskInput.placeholder;
    }
    
    async startAutomation() {
        const apiKey = this.elements.apiKey.value.trim();
        const task = this.elements.taskInput.value.trim();
        
        // Validation
        if (!apiKey) {
            this.log('Please enter your Gemini API key', 'error');
            this.elements.apiKey.focus();
            return;
        }
        
        if (!task && this.selectedMode !== 'assistant') {
            this.log('Please describe what you want to automate', 'error');
            this.elements.taskInput.focus();
            return;
        }
        
        if (!this.selectedMode) {
            this.log('Please select an automation mode', 'error');
            return;
        }
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Update UI state
        this.isRunning = true;
        this.elements.startBtn.disabled = true;
        this.elements.stopBtn.disabled = false;
        this.elements.statusIndicator.classList.remove('inactive');
        this.elements.statusText.textContent = 'Starting automation...';
        
        // Clear logs
        this.clearLogs();
        this.log(`Starting ${this.selectedMode} mode: ${task || 'Monitoring'}`, 'info');
        
        // Send to background
        this.sendToBackground('START_AUTOMATION', {
            mode: this.selectedMode,
            task: task,
            tabId: tab.id
        });
    }
    
    stopAutomation() {
        this.isRunning = false;
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.statusIndicator.classList.add('inactive');
        this.elements.statusText.textContent = 'Stopped';
        
        this.log('Automation stopped', 'info');
        
        // Send to background
        this.sendToBackground('STOP_AUTOMATION');
    }
    
    handleMessage(message) {
        if (message.type === 'notification') {
            const { data } = message;
            
            switch (data.type) {
                case 'status':
                    this.elements.statusText.textContent = data.message;
                    this.log(data.message, 'info');
                    break;
                    
                case 'action':
                    this.log(`⚡ ${data.message}`, 'info');
                    break;
                    
                case 'error':
                    this.log(`❌ ${data.message}`, 'error');
                    this.stopAutomation();
                    break;
                    
                case 'complete':
                    this.log(`✅ ${data.message}`, 'success');
                    this.stopAutomation();
                    this.elements.statusText.textContent = 'Completed';
                    break;
                    
                case 'tab_created':
                    this.log(`🌐 ${data.message}`, 'info');
                    break;
                    
                case 'assistant':
                    this.log(`🎯 ${data.message}`, 'success');
                    break;
                    
                default:
                    this.log(data.message, 'info');
            }
        }
    }
    
    sendToBackground(action, data = {}) {
        chrome.runtime.sendMessage({
            action,
            data
        }).catch(error => {
            console.error('Failed to send message:', error);
        });
    }
    
    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.elements.logs.appendChild(entry);
        this.elements.logs.scrollTop = this.elements.logs.scrollHeight;
        
        // Limit log entries
        const entries = this.elements.logs.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }
    
    clearLogs() {
        this.elements.logs.innerHTML = '';
    }
}

// Initialize UI controller
const ui = new UIController();