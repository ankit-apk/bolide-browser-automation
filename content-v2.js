// Content Script v2 - Clean DOM interaction layer

class DOMAutomation {
    constructor() {
        this.setupMessageListener();
        console.log('🎯 DOM Automation ready');
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            const { action, data } = request;
            
            switch (action) {
                case 'capture_screenshot':
                    this.captureScreenshot().then(sendResponse);
                    break;
                    
                case 'execute_action':
                    this.executeAction(data).then(sendResponse);
                    break;
                    
                case 'get_page_info':
                    sendResponse(this.getPageInfo());
                    break;
            }
            
            return true; // Keep channel open for async response
        });
    }
    
    async captureScreenshot() {
        try {
            // Method 1: Try using html2canvas if available
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    scrollY: -window.scrollY,
                    windowHeight: window.innerHeight,
                    scale: 0.8
                });
                return { screenshot: canvas.toDataURL('image/jpeg', 0.8) };
            }
            
            // Method 2: Create a visual representation
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set reasonable dimensions
            canvas.width = Math.min(window.innerWidth, 1280);
            canvas.height = Math.min(window.innerHeight, 720);
            
            // Fill background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw element representations
            this.drawElements(ctx);
            
            return { screenshot: canvas.toDataURL('image/jpeg', 0.8) };
            
        } catch (error) {
            console.error('Screenshot failed:', error);
            return { screenshot: null, error: error.message };
        }
    }
    
    drawElements(ctx) {
        // Draw representations of visible elements
        const elements = document.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, p, img');
        
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            
            // Skip invisible elements
            if (rect.width === 0 || rect.height === 0) return;
            if (rect.top > window.innerHeight || rect.bottom < 0) return;
            
            // Draw element outline
            ctx.strokeStyle = this.getElementColor(el);
            ctx.lineWidth = 2;
            ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
            
            // Draw text if available
            const text = el.textContent || el.value || el.placeholder || '';
            if (text && text.length < 50) {
                ctx.fillStyle = 'black';
                ctx.font = '12px Arial';
                ctx.fillText(text.substring(0, 30), rect.left + 5, rect.top + 15);
            }
        });
    }
    
    getElementColor(element) {
        const tag = element.tagName.toLowerCase();
        const colorMap = {
            'button': '#4CAF50',
            'a': '#2196F3',
            'input': '#FF9800',
            'select': '#9C27B0',
            'textarea': '#00BCD4',
            'h1': '#F44336',
            'h2': '#E91E63',
            'h3': '#9C27B0',
            'img': '#795548'
        };
        return colorMap[tag] || '#607D8B';
    }
    
    async executeAction(action) {
        try {
            console.log('Executing action:', action);
            
            // Show visual feedback
            this.showActionOverlay(action);
            
            switch (action.type) {
                case 'click':
                    return await this.click(action);
                    
                case 'type':
                    return await this.type(action);
                    
                case 'scroll':
                    return await this.scroll(action);
                    
                case 'wait':
                    return await this.wait(action);
                    
                case 'navigate':
                    return await this.navigate(action);
                    
                case 'select':
                    return await this.select(action);
                    
                case 'press_enter':
                    return await this.pressEnter(action);
                
                case 'complete':
                    // Allow AI to signal completion without erroring
                    return { success: true, complete: true };
                    
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            console.error('Action failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async click(action) {
        const element = this.findElement(action.selector);
        if (!element) {
            throw new Error(`Element not found: ${action.selector}`);
        }
        
        // Highlight element
        this.highlightElement(element);
        
        // Simulate click
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(500);
        
        element.click();
        
        // Also dispatch mouse events for better compatibility
        const events = ['mousedown', 'mouseup', 'click'];
        events.forEach(eventType => {
            element.dispatchEvent(new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true
            }));
        });
        
        return { success: true };
    }
    
    async type(action) {
        const element = this.findElement(action.selector);
        if (!element) {
            throw new Error(`Element not found: ${action.selector}`);
        }
        
        // Highlight and focus
        this.highlightElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(500);
        
        element.focus();
        
        // Clear existing value
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = '';
        }
        
        // Type new value
        element.value = action.value || action.text || '';
        
        // Dispatch events
        ['input', 'change'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, {
                bubbles: true,
                cancelable: true
            }));
        });
        // Guard InputEvent creation to prevent Illegal invocation in some contexts
        try {
            const inputEvt = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: element.value || '',
                inputType: 'insertText'
            });
            element.dispatchEvent(inputEvt);
        } catch (e) {}
        
        return { success: true };
    }
    
    async scroll(action) {
        const amount = action.amount || 500;
        const direction = action.direction || 'down';
        
        const scrollOptions = {
            behavior: 'smooth'
        };
        
        switch (direction) {
            case 'down':
                scrollOptions.top = window.scrollY + amount;
                break;
            case 'up':
                scrollOptions.top = window.scrollY - amount;
                break;
            case 'left':
                scrollOptions.left = window.scrollX - amount;
                break;
            case 'right':
                scrollOptions.left = window.scrollX + amount;
                break;
        }
        
        window.scrollTo(scrollOptions);
        await this.delay(500);
        
        return { success: true };
    }
    
    async wait(action) {
        const duration = action.duration || 1000;
        await this.delay(duration);
        return { success: true };
    }
    
    async navigate(action) {
        if (action.url) {
            window.location.href = action.url;
            return { success: true, navigating: true };
        }
        throw new Error('Navigate action requires a URL');
    }
    
    async select(action) {
        const element = this.findElement(action.selector);
        if (!element || element.tagName !== 'SELECT') {
            throw new Error(`Select element not found: ${action.selector}`);
        }
        
        this.highlightElement(element);
        element.value = action.value;
        
        element.dispatchEvent(new Event('change', {
            bubbles: true,
            cancelable: true
        }));
        
        return { success: true };
    }
    
    async pressEnter(action) {
        const element = document.activeElement || this.findElement('input, textarea');
        
        if (!element) {
            throw new Error('No active element to press Enter on');
        }
        
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(enterEvent);
        
        // Submit form if applicable
        const form = element.closest('form');
        if (form) {
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitButton) {
                submitButton.click();
            } else {
                form.submit();
            }
        }
        
        return { success: true };
    }
    
    findElement(selector) {
        if (!selector) return null;
        
        // Try multiple strategies
        const strategies = [
            () => document.querySelector(selector),
            () => document.querySelector(`[aria-label*="${selector}" i]`),
            () => document.querySelector(`[placeholder*="${selector}" i]`),
            () => document.querySelector(`[title*="${selector}" i]`),
            () => Array.from(document.querySelectorAll('*')).find(el => 
                el.textContent && el.textContent.toLowerCase().includes(selector.toLowerCase())
            )
        ];
        
        for (const strategy of strategies) {
            try {
                const element = strategy();
                if (element && this.isVisible(element)) {
                    return element;
                }
            } catch (e) {
                // Try next strategy
            }
        }
        
        return null;
    }
    
    isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }
    
    highlightElement(element) {
        const originalStyle = {
            border: element.style.border,
            backgroundColor: element.style.backgroundColor,
            outline: element.style.outline
        };
        
        element.style.outline = '3px solid #FF5722';
        element.style.backgroundColor = 'rgba(255, 87, 34, 0.1)';
        
        setTimeout(() => {
            element.style.outline = originalStyle.outline;
            element.style.backgroundColor = originalStyle.backgroundColor;
        }, 2000);
    }
    
    showActionOverlay(action) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">🤖 AI Automation</div>
            <div>${action.type.toUpperCase()}: ${action.description || action.selector || ''}</div>
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }, 3000);
        
        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    getPageInfo() {
        return {
            url: window.location.href,
            title: document.title,
            elements: {
                buttons: document.querySelectorAll('button').length,
                links: document.querySelectorAll('a').length,
                inputs: document.querySelectorAll('input, textarea, select').length
            }
        };
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize automation
const automation = new DOMAutomation();

// Inject html2canvas if not present
if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => console.log('📸 Screenshot library loaded');
    document.head.appendChild(script);
}