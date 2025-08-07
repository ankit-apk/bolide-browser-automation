// Visual Cursor System - Simulates mouse cursor with visual feedback
// Shows exactly where AI is clicking and provides better interaction

(function() {
    console.log('👁️ Visual Cursor System initialized');
    
    // Create cursor element
    let virtualCursor = null;
    let cursorTrail = [];
    let clickRipples = [];
    let highlightBox = null;
    let coordinateDisplay = null;
    
    // Initialize visual elements
    function initializeVisualElements() {
        // Remove any existing elements
        cleanup();
        
        // Create virtual cursor
        virtualCursor = document.createElement('div');
        virtualCursor.id = 'ai-virtual-cursor';
        virtualCursor.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.65 5.65L18.35 18.35L14.1 19.4L10.85 15.15L7.6 19.4L5.65 5.65Z" 
                      fill="#667eea" stroke="white" stroke-width="2"/>
            </svg>
            <div class="cursor-label">AI</div>
        `;
        virtualCursor.style.cssText = `
            position: fixed;
            width: 24px;
            height: 24px;
            pointer-events: none;
            z-index: 2147483647;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
            display: none;
        `;
        
        // Create coordinate display
        coordinateDisplay = document.createElement('div');
        coordinateDisplay.id = 'ai-coordinate-display';
        coordinateDisplay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 2147483646;
            display: none;
            backdrop-filter: blur(10px);
        `;
        
        // Create highlight box
        highlightBox = document.createElement('div');
        highlightBox.id = 'ai-highlight-box';
        highlightBox.style.cssText = `
            position: fixed;
            border: 3px solid #667eea;
            background: rgba(102, 126, 234, 0.1);
            pointer-events: none;
            z-index: 2147483645;
            border-radius: 8px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: none;
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
        `;
        
        // Add custom styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes ai-ripple {
                from {
                    transform: scale(0);
                    opacity: 1;
                }
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            @keyframes ai-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            .ai-click-ripple {
                position: fixed;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid #667eea;
                background: rgba(102, 126, 234, 0.3);
                pointer-events: none;
                z-index: 2147483644;
                animation: ai-ripple 0.6s ease-out;
            }
            
            .ai-cursor-trail {
                position: fixed;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(102, 126, 234, 0.5);
                pointer-events: none;
                z-index: 2147483643;
                transition: all 0.3s ease-out;
            }
            
            #ai-virtual-cursor .cursor-label {
                position: absolute;
                top: 20px;
                left: 20px;
                background: #667eea;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                white-space: nowrap;
            }
            
            #ai-virtual-cursor.clicking {
                animation: ai-pulse 0.3s ease;
            }
            
            .ai-element-info {
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                z-index: 2147483646;
                pointer-events: none;
                max-width: 300px;
                backdrop-filter: blur(10px);
            }
            
            .ai-scan-line {
                position: fixed;
                left: 0;
                width: 100%;
                height: 3px;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(102, 126, 234, 0.8), 
                    transparent);
                pointer-events: none;
                z-index: 2147483642;
                display: none;
            }
            
            @keyframes ai-scan {
                from { top: 0; }
                to { top: 100%; }
            }
            
            .ai-scan-line.scanning {
                display: block;
                animation: ai-scan 2s linear infinite;
            }
        `;
        
        document.head.appendChild(styleSheet);
        document.body.appendChild(virtualCursor);
        document.body.appendChild(coordinateDisplay);
        document.body.appendChild(highlightBox);
    }
    
    // Move cursor to position with trail effect
    async function moveCursor(x, y, duration = 1000) {
        if (!virtualCursor) initializeVisualElements();
        
        virtualCursor.style.display = 'block';
        coordinateDisplay.style.display = 'block';
        
        // Get current position or start from center
        const currentX = parseFloat(virtualCursor.style.left) || window.innerWidth / 2;
        const currentY = parseFloat(virtualCursor.style.top) || window.innerHeight / 2;
        
        // Create trail effect
        const steps = 20;
        const stepDuration = duration / steps;
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const easeProgress = easeInOutCubic(progress);
            
            const newX = currentX + (x - currentX) * easeProgress;
            const newY = currentY + (y - currentY) * easeProgress;
            
            // Update cursor position
            virtualCursor.style.left = `${newX}px`;
            virtualCursor.style.top = `${newY}px`;
            
            // Update coordinate display
            coordinateDisplay.textContent = `X: ${Math.round(newX)} Y: ${Math.round(newY)}`;
            
            // Create trail dot
            if (i % 2 === 0 && i < steps) {
                createTrailDot(newX, newY);
            }
            
            await sleep(stepDuration);
        }
        
        // Final position
        virtualCursor.style.left = `${x}px`;
        virtualCursor.style.top = `${y}px`;
        coordinateDisplay.textContent = `X: ${Math.round(x)} Y: ${Math.round(y)}`;
    }
    
    // Highlight element before clicking
    async function highlightElement(element) {
        if (!element || !highlightBox) return;
        
        const rect = element.getBoundingClientRect();
        
        highlightBox.style.display = 'block';
        highlightBox.style.left = `${rect.left - 3}px`;
        highlightBox.style.top = `${rect.top - 3}px`;
        highlightBox.style.width = `${rect.width + 6}px`;
        highlightBox.style.height = `${rect.height + 6}px`;
        
        // Show element info
        showElementInfo(element, rect);
        
        // Pulse effect
        highlightBox.style.animation = 'ai-pulse 0.5s ease 2';
        
        await sleep(1000);
    }
    
    // Show element information
    function showElementInfo(element, rect) {
        const info = document.createElement('div');
        info.className = 'ai-element-info';
        
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const text = element.textContent?.substring(0, 50) || '';
        
        info.innerHTML = `
            <div><strong>Element:</strong> ${tag}${id}${classes}</div>
            ${text ? `<div><strong>Text:</strong> ${text}...</div>` : ''}
            <div><strong>Size:</strong> ${Math.round(rect.width)}x${Math.round(rect.height)}</div>
        `;
        
        info.style.left = `${rect.right + 10}px`;
        info.style.top = `${rect.top}px`;
        
        document.body.appendChild(info);
        
        setTimeout(() => info.remove(), 3000);
    }
    
    // Simulate click with visual feedback
    async function simulateClick(x, y) {
        // Move cursor to position
        await moveCursor(x, y, 800);
        
        // Add clicking animation
        virtualCursor.classList.add('clicking');
        
        // Create click ripple
        const ripple = document.createElement('div');
        ripple.className = 'ai-click-ripple';
        ripple.style.left = `${x - 20}px`;
        ripple.style.top = `${y - 20}px`;
        document.body.appendChild(ripple);
        
        // Perform actual click
        const element = document.elementFromPoint(x, y);
        if (element) {
            // Create and dispatch mouse events
            const mouseEvents = ['mousedown', 'mouseup', 'click'];
            
            for (const eventType of mouseEvents) {
                const event = new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    screenX: x,
                    screenY: y
                });
                element.dispatchEvent(event);
                await sleep(50);
            }
        }
        
        // Cleanup
        setTimeout(() => {
            virtualCursor.classList.remove('clicking');
            ripple.remove();
        }, 600);
        
        return element;
    }
    
    // Create trail dot
    function createTrailDot(x, y) {
        const trail = document.createElement('div');
        trail.className = 'ai-cursor-trail';
        trail.style.left = `${x + 8}px`;
        trail.style.top = `${y + 8}px`;
        document.body.appendChild(trail);
        
        cursorTrail.push(trail);
        
        // Fade out and remove
        setTimeout(() => {
            trail.style.opacity = '0';
            trail.style.transform = 'scale(0.5)';
        }, 100);
        
        setTimeout(() => {
            trail.remove();
            cursorTrail = cursorTrail.filter(t => t !== trail);
        }, 400);
    }
    
    // Scan page for elements
    async function scanPage() {
        const scanLine = document.createElement('div');
        scanLine.className = 'ai-scan-line scanning';
        document.body.appendChild(scanLine);
        
        await sleep(2000);
        
        scanLine.remove();
    }
    
    // Find element with visual feedback
    async function findElementVisually(selector) {
        console.log('🔍 Visually searching for:', selector);
        
        // Show scanning effect
        await scanPage();
        
        // Try multiple strategies
        let element = null;
        let searchStrategy = '';
        
        // Strategy 1: Direct selector
        try {
            element = document.querySelector(selector);
            searchStrategy = 'selector';
        } catch (e) {}
        
        // Strategy 2: Find by text
        if (!element) {
            const elements = document.querySelectorAll('button, a, input, [role="button"], [onclick]');
            for (const el of elements) {
                const text = (el.textContent || el.value || el.placeholder || '').toLowerCase();
                if (text.includes(selector.toLowerCase())) {
                    element = el;
                    searchStrategy = 'text match';
                    break;
                }
            }
        }
        
        // Strategy 3: Find by attribute
        if (!element) {
            element = document.querySelector(`[aria-label*="${selector}" i]`) ||
                     document.querySelector(`[title*="${selector}" i]`) ||
                     document.querySelector(`[placeholder*="${selector}" i]`);
            searchStrategy = 'attribute';
        }
        
        if (element) {
            console.log(`✅ Found element using ${searchStrategy}`);
            await highlightElement(element);
            return element;
        }
        
        return null;
    }
    
    // Click element with visual cursor
    async function clickWithCursor(selector) {
        const element = await findElementVisually(selector);
        
        if (!element) {
            console.error('❌ Element not found:', selector);
            return { success: false, error: 'Element not found' };
        }
        
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Ensure element is in viewport
        if (y < 0 || y > window.innerHeight) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            const newRect = element.getBoundingClientRect();
            await simulateClick(newRect.left + newRect.width / 2, newRect.top + newRect.height / 2);
        } else {
            await simulateClick(x, y);
        }
        
        return { success: true, element: element.tagName };
    }
    
    // Type with visual feedback
    async function typeWithVisual(selector, text) {
        const element = await findElementVisually(selector);
        
        if (!element) {
            // Try to find any visible input
            const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
            for (const input of inputs) {
                if (isVisible(input)) {
                    await typeIntoElement(input, text);
                    return { success: true };
                }
            }
            return { success: false, error: 'No input field found' };
        }
        
        await typeIntoElement(element, text);
        return { success: true };
    }
    
    // Type into element with animation
    async function typeIntoElement(element, text) {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Move cursor to input
        await moveCursor(x, y, 500);
        
        // Click to focus
        await simulateClick(x, y);
        
        // Clear existing text
        element.value = '';
        
        // Type character by character with visual feedback
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Show typing indicator
            virtualCursor.querySelector('.cursor-label').textContent = char;
            
            await sleep(50 + Math.random() * 100);
        }
        
        virtualCursor.querySelector('.cursor-label').textContent = 'AI';
        
        // Dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Try to submit if it's a search field
        if (element.type === 'search' || element.name === 'q' || element.placeholder?.toLowerCase().includes('search')) {
            await sleep(500);
            
            // Look for submit button
            const submitBtn = element.form?.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn) {
                await clickWithCursor(submitBtn);
            } else {
                // Press Enter
                element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
            }
        }
    }
    
    // Helper functions
    function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }
    
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function cleanup() {
        // Remove all visual elements
        ['ai-virtual-cursor', 'ai-coordinate-display', 'ai-highlight-box'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        
        // Remove trails and ripples
        document.querySelectorAll('.ai-cursor-trail, .ai-click-ripple, .ai-element-info').forEach(el => el.remove());
    }
    
    // Message handler
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sendResponse);
        return true;
    });
    
    async function handleMessage(request, sendResponse) {
        console.log('Visual Cursor received:', request);
        
        try {
            switch (request.action) {
                case 'PING':
                    sendResponse({ success: true });
                    break;
                    
                case 'EXECUTE_ACTION':
                    const result = await executeVisualAction(request.data);
                    sendResponse(result);
                    break;
                    
                case 'CLEANUP':
                    cleanup();
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Visual cursor error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async function executeVisualAction(action) {
        console.log('Executing visual action:', action);
        
        // Initialize visual elements if needed
        if (!virtualCursor) {
            initializeVisualElements();
        }
        
        try {
            switch (action.type) {
                case 'navigate':
                    window.location.href = action.url;
                    return { success: true };
                    
                case 'click':
                    return await clickWithCursor(action.selector);
                    
                case 'type':
                    return await typeWithVisual(action.selector, action.text);
                    
                case 'scroll':
                    window.scrollBy({
                        top: action.direction === 'up' ? -500 : 500,
                        behavior: 'smooth'
                    });
                    return { success: true };
                    
                case 'wait':
                    await sleep(action.duration || 2000);
                    return { success: true };
                    
                case 'hover':
                    const element = await findElementVisually(action.selector);
                    if (element) {
                        const rect = element.getBoundingClientRect();
                        await moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2, 500);
                        return { success: true };
                    }
                    return { success: false, error: 'Element not found' };
                    
                default:
                    return { success: false, error: 'Unknown action type' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Auto-cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    
    console.log('✅ Visual Cursor System ready');
})();