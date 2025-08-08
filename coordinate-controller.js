// Coordinate-Based Controller - Pure simulation approach
// Uses mouse coordinates and keyboard simulation, no DOM manipulation

(function() {
    console.log('🎯 Coordinate Controller initialized');
    
    // Load Form Intelligence
    if (!window.FormIntelligence) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('form-intelligence.js');
        script.onload = () => console.log('📝 Form Intelligence loaded');
        document.head.appendChild(script);
    }
    
    // Visual cursor element
    let virtualCursor = null;
    let currentX = window.innerWidth / 2;
    let currentY = window.innerHeight / 2;
    
    // Initialize visual cursor
    function initCursor() {
        if (virtualCursor) return;
        
        // Create cursor element
        virtualCursor = document.createElement('div');
        virtualCursor.id = 'ai-cursor';
        virtualCursor.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M0,0 L0,15 L4,11 L7,17 L10,16 L7,10 L12,10 Z" 
                      fill="#667eea" stroke="white" stroke-width="1"/>
            </svg>
            <span style="position:absolute;top:20px;left:20px;background:#667eea;color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;">AI</span>
        `;
        
        virtualCursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            pointer-events: none;
            z-index: 2147483647;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            left: ${currentX}px;
            top: ${currentY}px;
        `;
        
        document.body.appendChild(virtualCursor);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes click-ripple {
                from { transform: scale(0); opacity: 1; }
                to { transform: scale(3); opacity: 0; }
            }
            
            .click-ripple {
                position: fixed;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: 2px solid #667eea;
                pointer-events: none;
                z-index: 2147483646;
                animation: click-ripple 0.5s ease-out;
            }
            
            .highlight-box {
                position: fixed;
                border: 2px solid #667eea;
                background: rgba(102, 126, 234, 0.1);
                pointer-events: none;
                z-index: 2147483645;
                border-radius: 4px;
                transition: all 0.2s;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Move cursor smoothly to coordinates
    async function moveCursor(x, y, duration = 500) {
        if (!virtualCursor) initCursor();
        
        const startX = currentX;
        const startY = currentY;
        const startTime = Date.now();
        
        return new Promise(resolve => {
            function animate() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = easeInOutCubic(progress);
                
                currentX = startX + (x - startX) * easeProgress;
                currentY = startY + (y - startY) * easeProgress;
                
                virtualCursor.style.left = `${currentX}px`;
                virtualCursor.style.top = `${currentY}px`;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            }
            animate();
        });
    }
    
    // Simulate mouse click at coordinates
    async function clickAt(x, y) {
        await moveCursor(x, y);
        
        // Visual feedback
        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        ripple.style.left = `${x - 15}px`;
        ripple.style.top = `${y - 15}px`;
        document.body.appendChild(ripple);
        
        // Get element at coordinates
        const element = document.elementFromPoint(x, y);
        
        if (element) {
            // Simulate real mouse events in sequence
            const mouseEvents = [
                new MouseEvent('mouseover', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }),
                new MouseEvent('mouseenter', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }),
                new MouseEvent('mousemove', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                }),
                new MouseEvent('mousedown', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0,
                    buttons: 1
                }),
                new MouseEvent('mouseup', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0,
                    buttons: 0
                }),
                new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0
                })
            ];
            
            for (const event of mouseEvents) {
                element.dispatchEvent(event);
                await sleep(10);
            }
            
            // Focus if it's an input
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.focus();
            }
        }
        
        // Remove ripple
        setTimeout(() => ripple.remove(), 500);
        
        return element;
    }
    
    // Find element by various methods and return coordinates
    async function findElementCoordinates(selector) {
        let element = null;
        let strategy = '';
        
        // Strategy 1: Try as CSS selector
        try {
            element = document.querySelector(selector);
            strategy = 'css selector';
        } catch (e) {}
        
        // Strategy 2: Find by visible text
        if (!element) {
            const allElements = Array.from(document.querySelectorAll('*'));
            for (const el of allElements) {
                const text = el.textContent?.trim();
                if (text && text.toLowerCase() === selector.toLowerCase()) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && isVisible(el)) {
                        element = el;
                        strategy = 'exact text';
                        break;
                    }
                }
            }
        }
        
        // Strategy 3: Find by partial text in clickable elements
        if (!element) {
            const clickables = document.querySelectorAll('button, a, input, textarea, select, [role="button"], [onclick], [tabindex]');
            for (const el of clickables) {
                const text = (el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
                if (text.includes(selector.toLowerCase())) {
                    if (isVisible(el)) {
                        element = el;
                        strategy = 'partial text';
                        break;
                    }
                }
            }
        }
        
        // Strategy 4: Special handling for common sites
        if (!element) {
            const { hostname } = window.location;
            
            if (hostname.includes('google')) {
                const searchSelectors = ['input[name="q"]', 'textarea[name="q"]', 'input.gLFyf'];
                for (const sel of searchSelectors) {
                    element = document.querySelector(sel);
                    if (element) {
                        strategy = 'google search';
                        break;
                    }
                }
            } else if (hostname.includes('amazon')) {
                const searchSelectors = ['#twotabsearchtextbox', 'input[name="field-keywords"]'];
                for (const sel of searchSelectors) {
                    element = document.querySelector(sel);
                    if (element) {
                        strategy = 'amazon search';
                        break;
                    }
                }
            }
        }
        
        if (!element) {
            console.log('❌ Element not found:', selector);
            return null;
        }
        
        console.log(`✅ Found element using ${strategy}`);
        
        // Get element coordinates
        const rect = element.getBoundingClientRect();
        
        // Ensure element is in viewport
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            const newRect = element.getBoundingClientRect();
            return {
                x: newRect.left + newRect.width / 2,
                y: newRect.top + newRect.height / 2,
                element
            };
        }
        
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            element
        };
    }
    
    // Improved typing with direct value assignment
    async function simulateTyping(text, fieldType = null) {
        const activeElement = document.activeElement;
        
        if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT')) {
            console.error('No input element focused');
            return false;
        }
        
        console.log(`Typing "${text}" into ${activeElement.name || activeElement.id || 'field'}`);
        
        // Clear and set value directly for reliability
        activeElement.focus();
        activeElement.click();
        
        // Special handling for select elements
        if (activeElement.tagName === 'SELECT') {
            const options = Array.from(activeElement.options);
            const match = options.find(opt => 
                opt.value.toLowerCase() === text.toLowerCase() ||
                opt.text.toLowerCase().includes(text.toLowerCase())
            );
            
            if (match) {
                activeElement.value = match.value;
                activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            return false;
        }
        
        // Clear the field
        activeElement.value = '';
        
        // Wait a bit
        await sleep(50);
        
        // Set the value directly - most reliable method
        activeElement.value = text;
        
        // Trigger React/Vue/Angular events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 
            'value'
        ).set;
        
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(activeElement, text);
        }
        
        // Dispatch all necessary events
        // Dispatch safe input/change events and guard InputEvent to avoid Illegal invocation
        activeElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        try {
            const inputEvt = new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text });
            activeElement.dispatchEvent(inputEvt);
        } catch (e) {}
        activeElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        
        // Force React to recognize the change
        const tracker = activeElement._valueTracker;
        if (tracker) {
            tracker.setValue('');
        }
        
        console.log('✅ Value set:', activeElement.value);
        return true;
    }
    
    // Alternative typing method - single character at a time but more reliable
    async function typeCharByChar(text) {
        const activeElement = document.activeElement;
        
        if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
            return false;
        }
        
        // Clear the field
        activeElement.value = '';
        
        // Build the text gradually
        let currentText = '';
        for (const char of text) {
            currentText += char;
            activeElement.value = currentText;
            
            // Dispatch input event for each character
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Small delay for visual effect
            await sleep(30);
        }
        
        // Final change event
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
    }
    
    // Press Enter key
    async function pressEnter() {
        const activeElement = document.activeElement;
        
        const events = [
            new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true
            }),
            new KeyboardEvent('keypress', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true
            }),
            new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true
            })
        ];
        
        for (const event of events) {
            activeElement.dispatchEvent(event);
            await sleep(10);
        }
        
        // Try to submit form if exists
        if (activeElement.form) {
            activeElement.form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
    }
    
    // Show paste indicator
    function showPasteIndicator(text) {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(102, 126, 234, 0.95);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            z-index: 2147483647;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: pastePopup 0.5s ease;
        `;
        
        indicator.innerHTML = `
            <div style="margin-bottom: 10px;">📋 Pasting Text:</div>
            <div style="font-size: 14px; font-weight: normal; opacity: 0.9; max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                "${text.length > 50 ? text.substring(0, 50) + '...' : text}"
            </div>
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pastePopup {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.05); }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
        
        // Remove after animation
        setTimeout(() => {
            indicator.style.animation = 'pastePopup 0.3s ease reverse';
            setTimeout(() => indicator.remove(), 300);
        }, 1000);
    }
    
    // Helper functions
    function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               rect.top < window.innerHeight &&
               rect.bottom > 0;
    }
    
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Message handler
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sendResponse);
        return true;
    });
    
    async function handleMessage(request, sendResponse) {
        console.log('Coordinate Controller received:', request.action);
        
        try {
            switch (request.action) {
                case 'PING':
                    sendResponse({ success: true, controller: 'coordinate' });
                    break;
                    
                case 'EXECUTE_ACTION':
                    const result = await executeAction(request.data);
                    sendResponse(result);
                    break;
                    
                case 'GET_PAGE_INFO':
                    sendResponse({
                        url: window.location.href,
                        title: document.title,
                        readyState: document.readyState
                    });
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
        
        if (!virtualCursor) initCursor();
        
        try {
            switch (action.type) {
                case 'navigate':
                    window.location.href = action.url;
                    return { success: true };
                    
                case 'click':
                    const coords = await findElementCoordinates(action.selector);
                    if (coords) {
                        await clickAt(coords.x, coords.y);
                        return { success: true, clicked: coords.element.tagName };
                    }
                    return { success: false, error: 'Element not found: ' + action.selector };
                    
                case 'type':
                    // Smart field detection if field type is provided
                    if (action.fieldType && window.FormIntelligence) {
                        const field = window.FormIntelligence.findFieldByType(action.fieldType);
                        if (field) {
                            const rect = field.getBoundingClientRect();
                            await clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
                            await sleep(200);
                            const success = await simulateTyping(action.text, action.fieldType);
                            return { success, field: action.fieldType };
                        }
                    }
                    
                    // Regular typing with selector
                    if (action.selector) {
                        const inputCoords = await findElementCoordinates(action.selector);
                        if (inputCoords) {
                            await clickAt(inputCoords.x, inputCoords.y);
                            await sleep(200);
                        }
                    }
                    
                    // Type the text
                    const typed = await simulateTyping(action.text);
                    if (typed) {
                        // Auto-submit for search fields
                        const activeEl = document.activeElement;
                        if (activeEl && (activeEl.type === 'search' || activeEl.name === 'q' || activeEl.placeholder?.toLowerCase().includes('search'))) {
                            await sleep(300);
                            await pressEnter();
                        }
                        return { success: true };
                    }
                    return { success: false, error: 'Failed to type text' };
                    
                case 'press_enter':
                    await pressEnter();
                    return { success: true };
                    
                case 'scroll':
                    const scrollAmount = action.direction === 'up' ? -500 : 500;
                    window.scrollBy({
                        top: scrollAmount,
                        behavior: 'smooth'
                    });
                    return { success: true };
                    
                case 'wait':
                    await sleep(action.duration || 2000);
                    return { success: true };
                    
                case 'hover':
                    const hoverCoords = await findElementCoordinates(action.selector);
                    if (hoverCoords) {
                        await moveCursor(hoverCoords.x, hoverCoords.y);
                        return { success: true };
                    }
                    return { success: false, error: 'Element not found' };
                    
                case 'fill_form':
                    // Smart form filling with field detection
                    if (!window.FormIntelligence) {
                        return { success: false, error: 'Form Intelligence not loaded' };
                    }
                    
                    const result = await window.FormIntelligence.fillForm(action.data);
                    if (result.success) {
                        return { 
                            success: true, 
                            filledFields: result.filledFields,
                            message: `Filled ${result.filledFields.length} fields`
                        };
                    }
                    return { success: false, error: result.error };
                    
                case 'analyze_form':
                    // Analyze current form and return field types
                    if (!window.FormIntelligence) {
                        return { success: false, error: 'Form Intelligence not loaded' };
                    }
                    
                    const forms = document.querySelectorAll('form');
                    const analysis = [];
                    
                    for (const form of forms) {
                        const fields = window.FormIntelligence.analyzeForm(form);
                        analysis.push({
                            formName: form.name || form.id || 'unnamed',
                            fields: fields.map(f => ({
                                type: f.type,
                                label: f.label,
                                required: f.required,
                                confidence: f.confidence
                            }))
                        });
                    }
                    
                    return { success: true, forms: analysis };
                    
                case 'complete':
                    return { success: true, complete: true };
                
                default:
                    return { success: false, error: 'Unknown action type: ' + action.type };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    console.log('✅ Coordinate Controller ready');
})();