// Smart Browser Controller - Enhanced Content Script
// Improved element finding and action execution

(function() {
    console.log('🎮 Smart Browser Controller initialized');

    // Listen for messages
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
            const actionType = action.type || action.action;
            showFeedback(`${actionType}: ${action.selector || action.text || action.url || ''}`);
            
            let result;
            
            switch (actionType) {
                case 'click':
                    result = await smartClick(action);
                    break;
                    
                case 'type':
                    result = await smartType(action);
                    break;
                    
                case 'scroll':
                    result = await scrollPage(action.direction || 'down', action.amount || 500);
                    break;
                    
                case 'navigate':
                    result = await navigateTo(action.url);
                    break;
                    
                case 'wait':
                    result = await waitFor(action.wait || action.time || 2000);
                    break;
                    
                case 'press':
                    result = await pressKey(action.key);
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

    // Smart click with multiple strategies
    async function smartClick(action) {
        // Try primary selector
        let element = findElementSmart(action.selector);
        
        // Try alternative selectors if provided
        if (!element && action.selectors) {
            for (const selector of action.selectors) {
                element = findElementSmart(selector);
                if (element) break;
            }
        }
        
        if (!element) {
            // Try to find clickable elements with similar text
            element = findClickableByText(action.selector);
        }
        
        if (!element) {
            throw new Error(`Cannot find clickable element: ${action.selector}`);
        }

        // Ensure element is in viewport
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // Highlight and click
        highlightElement(element);
        
        // Try multiple click methods
        try {
            element.click();
        } catch (e) {
            // Fallback to event dispatch
            element.dispatchEvent(new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            }));
        }

        return { message: `Clicked: ${action.selector}` };
    }

    // Smart type with better input finding
    async function smartType(action) {
        let element = findElementSmart(action.selector);
        
        // Try alternative selectors
        if (!element && action.selectors) {
            for (const selector of action.selectors) {
                element = findElementSmart(selector);
                if (element) break;
            }
        }
        
        // Try to find input by context
        if (!element) {
            element = findInputByContext(action.selector);
        }
        
        if (!element) {
            throw new Error(`Cannot find input: ${action.selector}`);
        }

        highlightElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);

        // Focus and clear
        element.focus();
        element.click(); // Sometimes needed to activate
        
        if (action.clear !== false) {
            element.value = '';
            // Also try select all and delete
            element.select && element.select();
        }

        // Type text with events
        element.value = action.text;
        
        // Trigger all relevant events
        ['input', 'change', 'keyup'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });

        return { message: `Typed: ${action.text}` };
    }

    // Enhanced element finding
    function findElementSmart(selector) {
        if (!selector) return null;
        
        const cleanSelector = selector.trim();
        
        // 1. Try as CSS selector
        try {
            const element = document.querySelector(cleanSelector);
            if (element && isElementInteractable(element)) {
                console.log('Found by CSS:', cleanSelector);
                return element;
            }
        } catch (e) {}

        // 2. Find by visible text (buttons, links)
        const clickables = document.querySelectorAll('button, a, [role="button"], [role="link"], input[type="submit"], input[type="button"]');
        for (const el of clickables) {
            const text = getElementText(el);
            if (text && textMatches(text, cleanSelector)) {
                if (isElementInteractable(el)) {
                    console.log('Found by text:', cleanSelector);
                    return el;
                }
            }
        }

        // 3. Find inputs by placeholder, label, or aria-label
        const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
        for (const el of inputs) {
            if (inputMatches(el, cleanSelector)) {
                if (isElementInteractable(el)) {
                    console.log('Found input by attributes:', cleanSelector);
                    return el;
                }
            }
        }

        // 4. Find by aria-label on any element
        const ariaElements = document.querySelectorAll(`[aria-label*="${cleanSelector}" i]`);
        for (const el of ariaElements) {
            if (isElementInteractable(el)) {
                console.log('Found by aria-label:', cleanSelector);
                return el;
            }
        }

        // 5. Find by partial attribute match
        const attrElements = document.querySelectorAll(`[title*="${cleanSelector}" i], [alt*="${cleanSelector}" i]`);
        for (const el of attrElements) {
            if (isElementInteractable(el)) {
                console.log('Found by attribute:', cleanSelector);
                return el;
            }
        }

        return null;
    }

    // Find clickable elements by text
    function findClickableByText(text) {
        const allElements = document.querySelectorAll('*');
        const candidates = [];
        
        for (const el of allElements) {
            // Skip if not clickable
            if (!isClickable(el)) continue;
            
            const elementText = getElementText(el);
            if (elementText && textMatches(elementText, text)) {
                candidates.push({
                    element: el,
                    score: calculateMatchScore(elementText, text)
                });
            }
        }
        
        // Return best match
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0].element;
        }
        
        return null;
    }

    // Find input by context
    function findInputByContext(context) {
        const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
        
        for (const input of inputs) {
            // Check placeholder
            if (input.placeholder && textMatches(input.placeholder, context)) {
                if (isElementInteractable(input)) return input;
            }
            
            // Check associated label
            const label = findLabelForInput(input);
            if (label && textMatches(getElementText(label), context)) {
                if (isElementInteractable(input)) return input;
            }
            
            // Check nearby text
            const nearbyText = getNearbyText(input);
            if (textMatches(nearbyText, context)) {
                if (isElementInteractable(input)) return input;
            }
        }
        
        return null;
    }

    // Helper: Get element text
    function getElementText(element) {
        return (element.textContent || element.value || element.innerText || '').trim();
    }

    // Helper: Text matching
    function textMatches(text1, text2) {
        const t1 = text1.toLowerCase().trim();
        const t2 = text2.toLowerCase().trim();
        
        // Exact match
        if (t1 === t2) return true;
        
        // Contains match
        if (t1.includes(t2) || t2.includes(t1)) return true;
        
        // Fuzzy match for common variations
        const variations = {
            'search': ['search', 'find', 'look for', 'query'],
            'sign in': ['sign in', 'log in', 'login', 'signin'],
            'directions': ['directions', 'route', 'navigate', 'get directions'],
            'maps': ['maps', 'map', 'google maps']
        };
        
        for (const [key, values] of Object.entries(variations)) {
            if (values.some(v => t2.includes(v)) && values.some(v => t1.includes(v))) {
                return true;
            }
        }
        
        return false;
    }

    // Helper: Input matching
    function inputMatches(input, text) {
        const lowerText = text.toLowerCase();
        
        // Check placeholder
        if (input.placeholder && input.placeholder.toLowerCase().includes(lowerText)) {
            return true;
        }
        
        // Check aria-label
        if (input.getAttribute('aria-label')?.toLowerCase().includes(lowerText)) {
            return true;
        }
        
        // Check name attribute
        if (input.name && input.name.toLowerCase().includes(lowerText)) {
            return true;
        }
        
        // Check id
        if (input.id && input.id.toLowerCase().includes(lowerText)) {
            return true;
        }
        
        return false;
    }

    // Helper: Calculate match score
    function calculateMatchScore(text1, text2) {
        const t1 = text1.toLowerCase();
        const t2 = text2.toLowerCase();
        
        if (t1 === t2) return 100;
        if (t1.includes(t2)) return 80;
        if (t2.includes(t1)) return 70;
        
        // Calculate similarity
        const words1 = t1.split(/\s+/);
        const words2 = t2.split(/\s+/);
        let matches = 0;
        
        for (const word of words2) {
            if (words1.some(w => w.includes(word) || word.includes(w))) {
                matches++;
            }
        }
        
        return (matches / words2.length) * 50;
    }

    // Helper: Check if element is clickable
    function isClickable(element) {
        const tag = element.tagName.toLowerCase();
        const clickableTags = ['a', 'button', 'input', 'select', 'textarea'];
        
        if (clickableTags.includes(tag)) return true;
        
        // Check for click handlers or role
        if (element.onclick || element.getAttribute('role') === 'button') return true;
        
        // Check for cursor pointer
        const style = window.getComputedStyle(element);
        if (style.cursor === 'pointer') return true;
        
        return false;
    }

    // Helper: Check if element is interactable
    function isElementInteractable(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // Check visibility
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        if (rect.width === 0 || rect.height === 0) return false;
        
        // Check if in viewport (with some tolerance)
        const inViewport = rect.top < window.innerHeight && rect.bottom > 0 &&
                          rect.left < window.innerWidth && rect.right > 0;
        
        return inViewport || true; // Allow off-screen elements that can be scrolled to
    }

    // Helper: Find label for input
    function findLabelForInput(input) {
        // Check for explicit label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }
        
        // Check for implicit label
        const parent = input.closest('label');
        if (parent) return parent;
        
        return null;
    }

    // Helper: Get nearby text
    function getNearbyText(element) {
        const parent = element.parentElement;
        if (!parent) return '';
        
        let text = '';
        
        // Get previous sibling text
        let prev = element.previousSibling;
        while (prev && text.length < 50) {
            if (prev.nodeType === Node.TEXT_NODE) {
                text = prev.textContent + text;
            } else if (prev.nodeType === Node.ELEMENT_NODE) {
                text = prev.textContent + text;
            }
            prev = prev.previousSibling;
        }
        
        // Get parent text
        text += ' ' + parent.textContent;
        
        return text.substring(0, 100);
    }

    // Navigate to URL
    async function navigateTo(url) {
        console.log('Navigating to:', url);
        
        if (!url) {
            throw new Error('No URL provided');
        }
        
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = 'https://' + url;
        }
        
        window.location.href = fullUrl;
        return { message: `Navigating to: ${fullUrl}` };
    }

    // Scroll page
    async function scrollPage(direction, amount) {
        const scrollAmount = direction === 'up' ? -amount : amount;
        
        window.scrollBy({
            top: scrollAmount,
            left: 0,
            behavior: 'smooth'
        });

        await sleep(500);
        return { message: `Scrolled ${direction} ${amount}px` };
    }

    // Wait
    async function waitFor(time) {
        await sleep(time);
        return { message: `Waited ${time}ms` };
    }

    // Press key
    async function pressKey(key) {
        const activeElement = document.activeElement || document.body;
        
        const keyMap = {
            'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
            'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
            'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
            'Space': { key: ' ', code: 'Space', keyCode: 32 },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }
        };

        const keyInfo = keyMap[key] || { key: key, code: key, keyCode: key.charCodeAt(0) };
        
        activeElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            bubbles: true,
            cancelable: true
        }));

        activeElement.dispatchEvent(new KeyboardEvent('keyup', {
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            bubbles: true,
            cancelable: true
        }));

        return { message: `Pressed key: ${key}` };
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
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        feedback.textContent = `🤖 ${message}`;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease';
            feedback.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(feedback);
                document.head.removeChild(style);
            }, 300);
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
        element.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
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

    console.log('✅ Smart Browser Controller ready');
})();