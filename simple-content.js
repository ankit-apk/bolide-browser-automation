// Simple Content Script for AI Browser Control
(function() {
    // Handle messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'PING':
                sendResponse({ success: true, message: 'Content script is ready' });
                return true;
                
            case 'CAPTURE_SCREENSHOT':
                captureScreenshot().then(screenshot => {
                    sendResponse({ screenshot });
                });
                return true;

            case 'EXECUTE_ACTION':
                executeAction(request.data).then(result => {
                    sendResponse({ success: true, result });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    });

    // Capture visible viewport as screenshot
    async function captureScreenshot() {
        try {
            // Method 1: Try using html2canvas if available
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: null,
                    scale: 0.5 // Lower quality for faster capture
                });
                return canvas.toDataURL('image/jpeg', 0.7);
            }

            // Method 2: Use canvas to capture visible area
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            canvas.width = width;
            canvas.height = height;

            // Draw white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            // Capture DOM as image (simplified representation)
            const bodyRect = document.body.getBoundingClientRect();
            
            // Draw a simplified version of the page
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, width, height);
            
            // Draw visible text elements
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < height && rect.bottom > 0 && 
                    rect.left < width && rect.right > 0) {
                    
                    const text = el.textContent?.trim();
                    if (text && el.childElementCount === 0) {
                        ctx.fillStyle = getComputedStyle(el).color || 'black';
                        ctx.font = `${getComputedStyle(el).fontSize} ${getComputedStyle(el).fontFamily}`;
                        ctx.fillText(text.substring(0, 50), rect.left, rect.top + rect.height/2);
                    }
                    
                    // Draw input fields and buttons
                    if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'A') {
                        ctx.strokeStyle = '#007bff';
                        ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
                    }
                }
            });

            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            // Return a placeholder image
            return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...'; // Minimal JPEG
        }
    }

    // Execute actions on the page
    async function executeAction(actionData) {
        const { action, selector, value, description } = actionData;
        
        console.log('Content script executing action:', actionData);

        // Show visual feedback
        showActionFeedback(description || `Executing ${action}`);

        try {
            switch (action) {
                case 'click':
                    return await clickElement(selector);
                
                case 'type':
                    return await typeText(selector, value);
                
                case 'scroll':
                    return await scrollPage(value);
                
                case 'navigate':
                    return await navigateTo(value);
                
                case 'complete':
                    return true;
                
                default:
                    console.error(`Unknown action: ${action}`);
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            console.error('Action execution failed:', error);
            throw error;
        }
    }

    function findElement(selector) {
        // Try multiple strategies to find element
        let element = null;

        // 1. Try as CSS selector
        try {
            element = document.querySelector(selector);
            if (element) return element;
        } catch (e) {}

        // 2. Try by text content
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            if (el.textContent?.trim() === selector || 
                el.getAttribute('aria-label') === selector ||
                el.getAttribute('placeholder') === selector ||
                el.getAttribute('title') === selector) {
                return el;
            }
        }

        // 3. Try fuzzy text match
        for (const el of allElements) {
            if (el.textContent?.toLowerCase().includes(selector.toLowerCase())) {
                return el;
            }
        }

        return null;
    }

    async function clickElement(selector) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        // Highlight element
        highlightElement(element);

        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // Click
        element.click();
        
        // Also dispatch events for better compatibility
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        return true;
    }

    async function typeText(selector, text) {
        const element = findElement(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        // Highlight element
        highlightElement(element);

        // Focus
        element.focus();
        await sleep(200);

        // Clear existing text
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = '';
            element.value = text;
            
            // Trigger events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            element.textContent = text;
        }

        return true;
    }

    async function scrollPage(direction) {
        console.log('Scrolling page:', direction);
        const scrollAmount = (direction === 'up' || direction === 'Up') ? -500 : 500;
        
        // Scroll the page
        window.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
        });
        
        // Visual feedback
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            z-index: 999999;
        `;
        indicator.textContent = `Scrolling ${direction}...`;
        document.body.appendChild(indicator);
        
        await sleep(500);
        
        // Remove indicator
        document.body.removeChild(indicator);
        
        console.log('Scroll completed');
        return { success: true, message: `Scrolled ${direction}` };
    }

    async function navigateTo(url) {
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        window.location.href = url;
        return true;
    }

    function highlightElement(element) {
        const originalBorder = element.style.border;
        const originalBackground = element.style.backgroundColor;
        
        element.style.border = '3px solid #ff6b6b';
        element.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
        
        setTimeout(() => {
            element.style.border = originalBorder;
            element.style.backgroundColor = originalBackground;
        }, 2000);
    }

    function showActionFeedback(message) {
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 999999;
            animation: slideIn 0.3s ease;
        `;
        feedback.textContent = `🤖 ${message}`;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(feedback);
            }, 300);
        }, 3000);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Add animation styles
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
})();