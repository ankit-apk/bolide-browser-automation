// Browser Controller - Content Script
// This runs on web pages and executes actions

(function() {
    console.log('🎮 Browser Controller initialized');

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sender, sendResponse);
        return true;
    });

    async function handleMessage(request, sender, sendResponse) {
        console.log('📨 Content script received:', request.action);
        
        switch (request.action) {
            case 'PING':
                sendResponse({ success: true, message: 'Content script ready' });
                break;
                
            case 'EXECUTE_ACTION':
                const result = await executeAction(request.data);
                sendResponse(result);
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    // Main action executor
    async function executeAction(action) {
        console.log('⚡ Executing:', action);
        
        try {
            // Show visual feedback
            const actionType = action.type || action.action;
            showFeedback(`${actionType}: ${action.selector || action.text || action.url || ''}`);
            
            let result;
            
            switch (actionType) {
                case 'click':
                    result = await clickElement(action.selector);
                    break;
                    
                case 'type':
                    result = await typeText(action.selector, action.text, action.clear);
                    break;
                    
                case 'scroll':
                    result = await scrollPage(action.direction || 'down', action.amount || 500);
                    break;
                    
                case 'navigate':
                    result = await navigateTo(action.url);
                    break;
                    
                case 'wait':
                    result = await waitFor(action.time || action.wait || 2000);
                    break;
                    
                case 'select':
                    result = await selectOption(action.selector, action.value);
                    break;
                    
                case 'press':
                    result = await pressKey(action.key);
                    break;
                    
                case 'hover':
                    result = await hoverElement(action.selector);
                    break;
                    
                case 'check':
                    result = await checkElement(action.selector, action.checked);
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${actionType}`);
            }
            
            console.log('✅ Action completed:', result);
            return { success: true, ...result };
            
        } catch (error) {
            console.error('❌ Action failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Find element using multiple strategies
    function findElement(selector) {
        if (!selector) return null;
        
        // Clean the selector
        const cleanSelector = selector.trim();
        
        // Strategy 1: Direct CSS selector
        try {
            const element = document.querySelector(cleanSelector);
            if (element && isElementVisible(element)) {
                console.log('Found by CSS selector:', cleanSelector);
                return element;
            }
        } catch (e) {
            // Not a valid CSS selector, continue with other strategies
        }

        // Strategy 2: Find by exact or partial text content
        const textElements = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], span[role="button"]');
        for (const el of textElements) {
            const elementText = (el.textContent || el.value || '').trim();
            if (elementText.toLowerCase() === cleanSelector.toLowerCase() ||
                elementText.toLowerCase().includes(cleanSelector.toLowerCase())) {
                if (isElementVisible(el)) {
                    console.log('Found by text content:', cleanSelector);
                    return el;
                }
            }
        }

        // Strategy 3: Find input/textarea by placeholder, aria-label, or name
        const inputs = document.querySelectorAll('input, textarea');
        for (const el of inputs) {
            const placeholder = el.placeholder || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const name = el.getAttribute('name') || '';
            const id = el.getAttribute('id') || '';
            
            if (placeholder.toLowerCase().includes(cleanSelector.toLowerCase()) ||
                ariaLabel.toLowerCase().includes(cleanSelector.toLowerCase()) ||
                name.toLowerCase() === cleanSelector.toLowerCase() ||
                id.toLowerCase() === cleanSelector.toLowerCase()) {
                if (isElementVisible(el)) {
                    console.log('Found input by attribute:', cleanSelector);
                    return el;
                }
            }
        }

        // Strategy 4: Find by aria-label on any element
        const ariaElements = document.querySelectorAll('[aria-label]');
        for (const el of ariaElements) {
            if (el.getAttribute('aria-label').toLowerCase().includes(cleanSelector.toLowerCase())) {
                if (isElementVisible(el)) {
                    console.log('Found by aria-label:', cleanSelector);
                    return el;
                }
            }
        }

        // Strategy 5: Special Google search handling
        if (cleanSelector.toLowerCase().includes('search')) {
            // Try to find Google search box
            const googleSearch = document.querySelector('input[name="q"], input[title*="Search"], textarea[name="q"]');
            if (googleSearch && isElementVisible(googleSearch)) {
                console.log('Found Google search input');
                return googleSearch;
            }
            
            // Try to find Google search button
            const googleButton = document.querySelector('input[name="btnK"], input[value="Google Search"], button[aria-label*="Search"]');
            if (googleButton && isElementVisible(googleButton)) {
                console.log('Found Google search button');
                return googleButton;
            }
        }

        console.log('Element not found:', cleanSelector);
        return null;
    }

    // Check if element is visible
    function isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    // Click an element
    async function clickElement(selector) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        // Highlight element
        highlightElement(element);
        
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Click the element
        element.click();
        
        // Also dispatch mouse events for better compatibility
        const events = ['mousedown', 'mouseup', 'click'];
        for (const eventType of events) {
            element.dispatchEvent(new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true
            }));
        }

        return { message: `Clicked: ${selector}` };
    }

    // Type text into an input
    async function typeText(selector, text, clear = true) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Input not found: ${selector}`);
        }

        highlightElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Focus the element
        element.focus();

        // Clear if requested
        if (clear) {
            element.value = '';
        }

        // Type the text
        element.value = text;

        // Trigger input events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return { message: `Typed: ${text}` };
    }

    // Scroll the page
    async function scrollPage(direction = 'down', amount = 500) {
        const scrollAmount = direction === 'up' ? -amount : amount;
        
        window.scrollBy({
            top: scrollAmount,
            left: 0,
            behavior: 'smooth'
        });

        await sleep(500);
        return { message: `Scrolled ${direction} ${amount}px` };
    }

    // Navigate to URL
    async function navigateTo(url) {
        console.log('Navigating to:', url);
        
        if (!url) {
            throw new Error('No URL provided for navigation');
        }
        
        // Fix URL if needed
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = 'https://' + url;
        }
        
        console.log('Full URL:', fullUrl);
        
        try {
            window.location.href = fullUrl;
            return { message: `Navigating to: ${fullUrl}` };
        } catch (error) {
            console.error('Navigation error:', error);
            throw new Error(`Failed to navigate to ${fullUrl}: ${error.message}`);
        }
    }

    // Wait for time or element
    async function waitFor(timeOrSelector) {
        if (typeof timeOrSelector === 'number') {
            await sleep(timeOrSelector);
            return { message: `Waited ${timeOrSelector}ms` };
        } else {
            // Wait for element to appear
            const maxWait = 10000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                if (findElement(timeOrSelector)) {
                    return { message: `Element appeared: ${timeOrSelector}` };
                }
                await sleep(100);
            }
            
            throw new Error(`Timeout waiting for: ${timeOrSelector}`);
        }
    }

    // Select dropdown option
    async function selectOption(selector, value) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Select not found: ${selector}`);
        }

        highlightElement(element);
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return { message: `Selected: ${value}` };
    }

    // Press a key
    async function pressKey(key) {
        const activeElement = document.activeElement || document.body;
        
        const keyMap = {
            'Enter': 13,
            'Tab': 9,
            'Escape': 27,
            'Space': 32,
            'ArrowDown': 40,
            'ArrowUp': 38
        };

        const keyCode = keyMap[key] || key.charCodeAt(0);
        
        activeElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: key,
            keyCode: keyCode,
            bubbles: true
        }));

        activeElement.dispatchEvent(new KeyboardEvent('keyup', {
            key: key,
            keyCode: keyCode,
            bubbles: true
        }));

        return { message: `Pressed key: ${key}` };
    }

    // Hover over element
    async function hoverElement(selector) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        highlightElement(element);
        
        element.dispatchEvent(new MouseEvent('mouseenter', {
            view: window,
            bubbles: true,
            cancelable: true
        }));

        element.dispatchEvent(new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
        }));

        return { message: `Hovered: ${selector}` };
    }

    // Check/uncheck element
    async function checkElement(selector, checked = true) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Checkbox not found: ${selector}`);
        }

        highlightElement(element);
        
        if (element.checked !== checked) {
            element.click();
        }

        return { message: `${checked ? 'Checked' : 'Unchecked'}: ${selector}` };
    }

    // Visual feedback
    function showFeedback(message) {
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 2147483647;
            animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s;
            max-width: 300px;
        `;
        feedback.textContent = `🤖 ${message}`;
        
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
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            document.body.removeChild(feedback);
            document.head.removeChild(style);
        }, 3000);
    }

    // Highlight element
    function highlightElement(element) {
        const originalStyle = {
            outline: element.style.outline,
            boxShadow: element.style.boxShadow,
            backgroundColor: element.style.backgroundColor
        };
        
        element.style.outline = '3px solid #667eea';
        element.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.5)';
        element.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        
        setTimeout(() => {
            element.style.outline = originalStyle.outline;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.backgroundColor = originalStyle.backgroundColor;
        }, 2000);
    }

    // Utility: sleep
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log('✅ Browser Controller ready');
})();