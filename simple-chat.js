// Simple Chat UI Controller
class ChatController {
    constructor() {
        this.isConnected = false;
        this.activeTabId = null;
        
        this.elements = {
            apiKey: document.getElementById('apiKey'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            chatContainer: document.getElementById('chatContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn')
        };
        
        this.initialize();
    }
    
    async initialize() {
        // Load saved API key
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
            this.elements.apiKey.value = result.geminiApiKey;
            this.sendMessage('SET_API_KEY', { apiKey: result.geminiApiKey });
        }
        
        // Event listeners
        this.elements.apiKey.addEventListener('change', () => this.saveApiKey());
        this.elements.startBtn.addEventListener('click', () => this.startStreaming());
        this.elements.stopBtn.addEventListener('click', () => this.stopStreaming());
        this.elements.sendBtn.addEventListener('click', () => this.sendChatMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Listen for messages from background
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'notification') {
                this.handleNotification(message.data);
            }
        });
    }
    
    async saveApiKey() {
        const apiKey = this.elements.apiKey.value.trim();
        if (apiKey) {
            await chrome.storage.local.set({ geminiApiKey: apiKey });
            this.sendMessage('SET_API_KEY', { apiKey });
            this.addMessage('system', 'API key saved successfully');
        }
    }
    
    async startStreaming() {
        const apiKey = this.elements.apiKey.value.trim();
        if (!apiKey) {
            this.addMessage('error', 'Please enter your Gemini API key first');
            this.elements.apiKey.focus();
            return;
        }
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.activeTabId = tab.id;
        
        // Update UI
        this.isConnected = true;
        this.elements.startBtn.disabled = true;
        this.elements.stopBtn.disabled = false;
        this.elements.messageInput.disabled = false;
        this.elements.sendBtn.disabled = false;
        this.elements.statusIndicator.classList.remove('disconnected');
        this.elements.statusIndicator.classList.add('connected');
        this.elements.statusText.textContent = 'Connecting...';
        
        // Clear instructions and add start message
        const instructions = this.elements.chatContainer.querySelector('.instructions');
        if (instructions) {
            instructions.remove();
        }
        
        this.addMessage('system', 'Connecting to AI automation engine...');
        
        // Send to background with initial task prompt
        this.sendMessage('START_AUTOMATION', { 
            tabId: tab.id,
            task: 'Ready to help. What would you like me to do?'
        });
    }
    
    stopStreaming() {
        this.isConnected = false;
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;
        this.elements.statusIndicator.classList.remove('connected');
        this.elements.statusIndicator.classList.add('disconnected');
        this.elements.statusText.textContent = 'Not connected';
        
        this.addMessage('system', 'Automation stopped');
        
        // Send to background
        this.sendMessage('STOP_AUTOMATION');
    }
    
    sendChatMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text) return;
        
        // Add to chat
        this.addMessage('user', text);
        
        // Clear input
        this.elements.messageInput.value = '';
        
        // Send task to automation engine
        this.sendMessage('EXECUTE_TASK', { task: text });
    }
    
    handleNotification(data) {
        switch (data.type) {
            case 'status':
                this.elements.statusText.textContent = data.message;
                if (data.message.includes('Connected')) {
                    this.addMessage('system', data.message);
                }
                break;
                
            case 'message':
                this.addMessage('assistant', data.message);
                break;
                
            case 'action':
                this.addMessage('action', `⚡ ${data.message}`);
                break;
                
            case 'success':
                this.addMessage('success', data.message);
                break;
                
            case 'error':
                this.addMessage('error', data.message);
                break;
                
            case 'user_message':
                // Already added when sent
                break;
        }
    }
    
    addMessage(type, content) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        // Set avatar emoji based on type
        const avatars = {
            user: '👤',
            assistant: '🤖',
            action: '⚡',
            error: '❌',
            system: 'ℹ️',
            success: '✅'
        };
        avatar.textContent = avatars[type] || '💬';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        message.appendChild(avatar);
        message.appendChild(messageContent);
        
        this.elements.chatContainer.appendChild(message);
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }
    
    sendMessage(action, data = {}) {
        chrome.runtime.sendMessage({
            action,
            data
        }).catch(error => {
            console.error('Failed to send message:', error);
        });
    }
}

// Initialize chat controller
const chat = new ChatController();