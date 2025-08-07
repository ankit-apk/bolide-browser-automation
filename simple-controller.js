// Simple Controller - Content Script for Smart Engine V2
// Handles basic browser automation with improved selectors

(function() {
    console.log('🎯 Simple Controller initialized');
    
    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sendResponse);
        return true;
    });
    
    async function handleMessage(request, sendResponse) {
        console.log('Received:', request.action);
        
        try {
            switch (request.action) {
                case 'PING':
                    sendResponse({ success: true });
                    break;
                    
                case 'EXECUTE_ACTION':
                    const result = await executeAction(request.data);
                    sendResponse(result);
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async function executeAction(action) {
        console.log('Executing:', action);
        
        try {
            switch (action.type) {
                case 'navigate':
                    window.location.href = action.url;
                    return { success: true };
                    
                case 'click':
                    return await clickElement(action.selector);
                    
                case 'type':
                    return await typeText(action.selector, action.text);
                    
                case 'scroll':
                    window.scrollBy({
                        top: action.direction === 'up' ? -500 : 500,
                        behavior: 'smooth'
                    });
                    return { success: true };
                    
                case 'wait':
                    await sleep(action.duration || 2000);
                    return { success: true };
                    
                default:
                    return { success: false, error: 'Unknown action type' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async function clickElement(selector) {
        console.log('Clicking:', selector);
        
        // Try to find element with multiple strategies
        let element = null;
        
        // Strategy 1: Direct selector
        try {
            element = document.querySelector(selector);
        } catch (e) {}
        
        // Strategy 2: Text content search
        if (!element) {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.textContent && el.textContent.trim().toLowerCase() === selector.toLowerCase()) {
                    if (isClickable(el)) {
                        element = el;
                        break;
                    }
                }
            }
        }
        
        // Strategy 3: Partial text match
        if (!element) {
            const allElements = document.querySelectorAll('button, a, input, [role="button"], [onclick]');
            for (const el of allElements) {
                const text = (el.textContent || el.value || el.placeholder || '').toLowerCase();
                if (text.includes(selector.toLowerCase())) {
                    element = el;
                    break;
                }
            }
        }
        
        // Strategy 4: Common selectors for Google
        if (!element && window.location.hostname.includes('google')) {
            const googleSelectors = [
                'input[name="q"]',
                'textarea[name="q"]',
                'input.gLFyf',
                'input[title="Search"]',
                'input[aria-label="Search"]',
                '.RNNXgb input',
                '.SDkEP input'
            ];
            
            for (const sel of googleSelectors) {
                element = document.querySelector(sel);
                if (element) break;
            }
        }
        
        // Strategy 5: Common selectors for Amazon
        if (!element && (window.location.hostname.includes('amazon') || selector.toLowerCase().includes('amazon'))) {
            // First navigate to Amazon if not there
            if (!window.location.hostname.includes('amazon')) {
                window.location.href = 'https://www.amazon.in';
                return { success: true, message: 'Navigating to Amazon.in' };
            }
            
            const amazonSelectors = [
                '#twotabsearchtextbox',
                'input[name="field-keywords"]',
                'input[placeholder*="Search Amazon"]',
                '#nav-search-bar-form input'
            ];
            
            for (const sel of amazonSelectors) {
                element = document.querySelector(sel);
                if (element) break;
            }
        }
        
        if (!element) {
            return { success: false, error: `Element not found: ${selector}` };
        }
        
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        
        // Click the element
        element.click();
        
        // For input elements, also focus
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.focus();
        }
        
        return { success: true };
    }
    
    async function typeText(selector, text) {
        console.log('Typing:', text, 'into:', selector);
        
        let element = null;
        
        // Try direct selector first
        try {
            element = document.querySelector(selector);
        } catch (e) {}
        
        // Try to find any visible text input
        if (!element) {
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
            for (const input of inputs) {
                const rect = input.getBoundingClientRect();
                const style = window.getComputedStyle(input);
                
                if (rect.width > 0 && rect.height > 0 && 
                    style.display !== 'none' && style.visibility !== 'hidden') {
                    element = input;
                    break;
                }
            }
        }
        
        // Special handling for Google search
        if (!element && window.location.hostname.includes('google')) {
            element = document.querySelector('input[name="q"]') || 
                     document.querySelector('textarea[name="q"]') ||
                     document.querySelector('input.gLFyf');
        }
        
        // Special handling for Amazon search
        if (!element && window.location.hostname.includes('amazon')) {
            element = document.querySelector('#twotabsearchtextbox') ||
                     document.querySelector('input[name="field-keywords"]');
        }
        
        if (!element) {
            return { success: false, error: 'No input field found' };
        }
        
        // Focus and clear
        element.focus();
        element.click();
        element.value = '';
        
        // Type character by character
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50 + Math.random() * 50);
        }
        
        // Dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // For search fields, try to submit
        if (element.form) {
            // Look for submit button
            const submitBtn = element.form.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            } else {
                // Try Enter key
                element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            }
        }
        
        return { success: true };
    }
    
    function isClickable(element) {
        const clickableTags = ['a', 'button', 'input', 'select', 'textarea'];
        const tag = element.tagName.toLowerCase();
        
        return clickableTags.includes(tag) ||
               element.onclick ||
               element.getAttribute('role') === 'button' ||
               window.getComputedStyle(element).cursor === 'pointer';
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Notify that content script is ready
    console.log('✅ Simple Controller ready');
})();