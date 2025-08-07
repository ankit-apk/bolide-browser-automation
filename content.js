// Content script for web page interaction
console.log('AI Web Automation content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureScreenshot') {
        const options = request.options || {};
        captureVisibleArea(options).then(screenshot => {
            sendResponse({ screenshot: screenshot });
        }).catch(error => {
            sendResponse({ error: error.message });
        });
        return true;
    } else if (request.action === 'executeAction') {
        executeAction(request.actionData, request.showOverlay).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'executeLiveAction') {
        // Execute action from live mode (restricted to click, type, scroll, tap)
        executeLiveAction(request.actionData).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'cleanup') {
        cleanupOverlay();
        sendResponse({ success: true });
    }
});

async function captureVisibleArea(options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const maxWidth = options.maxWidth || 1920;
            const maxHeight = options.maxHeight || 1080;
            const quality = options.quality || 0.8;
            // Use html2canvas if available, otherwise use DOM serialization
            if (typeof html2canvas !== 'undefined') {
                html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    scrollY: -window.scrollY,
                    windowHeight: window.innerHeight
                }).then(canvas => {
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                }).catch(reject);
            } else {
                // Fallback: capture using DOM to canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                
                // Create a simple representation
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Try to capture visible DOM elements
                const elements = document.querySelectorAll('*');
                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        ctx.strokeStyle = '#ccc';
                        ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
                        
                        // Add text content if available
                        if (el.textContent && el.children.length === 0) {
                            ctx.fillStyle = 'black';
                            ctx.font = '12px Arial';
                            ctx.fillText(el.textContent.substring(0, 20), rect.left + 5, rect.top + 15);
                        }
                    }
                });
                
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            }
        } catch (error) {
            // Ultimate fallback: send viewport dimensions and basic page info
            const pageInfo = {
                url: window.location.href,
                title: document.title,
                width: window.innerWidth,
                height: window.innerHeight,
                elements: Array.from(document.querySelectorAll('button, a, input, select, textarea')).slice(0, 50).map(el => ({
                    tag: el.tagName,
                    text: el.textContent || el.value || '',
                    id: el.id,
                    class: el.className,
                    rect: el.getBoundingClientRect()
                }))
            };
            
            // Create a data URL with page info
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const dataUrl = canvas.toDataURL('image/jpeg');
            
            resolve(dataUrl + '#pageinfo:' + btoa(JSON.stringify(pageInfo)));
        }
    });
}

// Helper function to check if element is visible
function isElementVisible(element) {
    if (!element) return false;
    
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

// Helper function to find the best matching element
function findBestElement(selectors, preferVisible = true) {
    for (let selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
                if (!preferVisible || isElementVisible(element)) {
                    return element;
                }
            }
        } catch (e) {
            // Invalid selector, skip
            continue;
        }
    }
    return null;
}

async function executeAction(actionData, showOverlay = true) {
    try {
        if (showOverlay) {
            showActionOverlay(actionData);
        }

        switch (actionData.type) {
            case 'navigate':
                return await performNavigate(actionData);
                
            case 'click':
                return await performClick(actionData);
            
            case 'type':
                return await performType(actionData);
                
            case 'press_enter':
                return await performPressEnter(actionData);
            
            case 'select':
                return await performSelect(actionData);
            
            case 'scroll':
                return await performScroll(actionData);
            
            case 'wait':
                return await performWait(actionData);
            
            default:
                throw new Error(`Unknown action type: ${actionData.type}`);
        }
    } catch (error) {
        console.error('Action execution error:', error);
        return { success: false, error: error.message };
    }
}

async function performClick(actionData) {
    let element = null;
    
    // Build a list of selectors to try
    const selectors = [];
    
    // Add the provided selector first
    if (actionData.selector) {
        selectors.push(actionData.selector);
    }
    
    // Add fallback selectors based on description
    if (actionData.description) {
        const desc = actionData.description.toLowerCase();
        
        if (desc.includes('search')) {
            // If it's about clicking a search INPUT (not button)
            if (desc.includes('input') || desc.includes('box') || desc.includes('field')) {
                selectors.push(
                    'input[type="search"]',
                    'input[name="q"]',
                    'input[name="search"]',
                    'input[placeholder*="search" i]',
                    'input[aria-label*="search" i]',
                    '#search',
                    '.search-input',
                    '.search-box',
                    'input[type="text"]'
                );
            } else {
                // Search buttons
                selectors.push(
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button[aria-label*="search" i]',
                    '.search-button',
                    'button[class*="search"]'
                );
            }
        }
        
        if (desc.includes('button')) {
            selectors.push(
                'button:not([disabled])',
                'input[type="button"]:not([disabled])',
                'a.button',
                'a.btn',
                '[role="button"]'
            );
        }
    }
    
    // Try to find element by selectors
    element = findBestElement(selectors, true);
    
    // If no element found and coordinates provided, try clicking at coordinates
    if (!element && actionData.coordinates) {
        element = document.elementFromPoint(actionData.coordinates.x, actionData.coordinates.y);
    }
    
    if (element && isElementVisible(element)) {
        // Highlight element
        highlightElement(element);
        
        // Create and dispatch mouse events
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: actionData.coordinates ? actionData.coordinates.x : element.getBoundingClientRect().left + element.offsetWidth / 2,
            clientY: actionData.coordinates ? actionData.coordinates.y : element.getBoundingClientRect().top + element.offsetHeight / 2
        });
        
        element.dispatchEvent(clickEvent);
        
        // Also trigger mousedown and mouseup for better compatibility
        const mousedownEvent = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        const mouseupEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(mousedownEvent);
        element.dispatchEvent(mouseupEvent);
        
        // For links, also try to navigate
        if (element.tagName === 'A' && element.href) {
            window.location.href = element.href;
        }
        
        return { success: true };
    } else {
        throw new Error(`Element not found: ${actionData.selector || 'at coordinates'}`);
    }
}

async function performType(actionData) {
    let element = null;
    
    // Build a list of selectors to try
    const selectors = [];
    
    // Add the provided selector first if it exists
    if (actionData.selector) {
        selectors.push(actionData.selector);
    }
    
    // Add common fallback selectors based on the context
    const isSearchTask = (actionData.description && actionData.description.toLowerCase().includes('search')) ||
                        (actionData.text && actionData.text.toLowerCase().includes('search'));
    
    if (isSearchTask) {
        selectors.push(
            'input[type="search"]',
            'input[name="q"]',
            'input[name="search"]',
            'input[name="query"]',
            'input[placeholder*="search" i]',
            'input[aria-label*="search" i]',
            'input[role="searchbox"]',
            '#search',
            '.search-input',
            '.search-box',
            '.search-field',
            'input[class*="search"]',
            'input[id*="search"]'
        );
    }
    
    // Add generic input selectors
    selectors.push(
        'input[type="text"]:not([readonly]):not([disabled])',
        'input[type="email"]:not([readonly]):not([disabled])',
        'input[type="tel"]:not([readonly]):not([disabled])',
        'input[type="url"]:not([readonly]):not([disabled])',
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled])',
        'textarea:not([readonly]):not([disabled])',
        '[contenteditable="true"]'
    );
    
    // Try to find the best element
    element = findBestElement(selectors, true);
    
    if (element) {
        highlightElement(element);
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Focus the element
        element.focus();
        
        // Clear existing value if it's an input
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = '';
            
            // Trigger clear events
            element.dispatchEvent(new Event('focus', { bubbles: true }));
            element.dispatchEvent(new Event('click', { bubbles: true }));
            
            // Clear the field completely first
            element.value = '';
            
            // Set the entire text at once (more reliable than character-by-character)
            element.value = actionData.text;
            
            // Dispatch events for compatibility
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new InputEvent('input', { 
                bubbles: true, 
                cancelable: true,
                data: actionData.text,
                inputType: 'insertText'
            }));
            
            // Dispatch change and blur events at the end
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            
        } else if (element.hasAttribute('contenteditable')) {
            // For contenteditable elements
            element.textContent = actionData.text;
            
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        } else {
            // Fallback for other elements
            element.value = actionData.text;
            element.textContent = actionData.text;
        }
        
        return { success: true, element: element.tagName + (element.id ? '#' + element.id : '') };
    } else {
        // Provide detailed error information
        const allInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]');
        const visibleInputs = Array.from(allInputs).filter(isElementVisible);
        
        const inputInfo = visibleInputs.slice(0, 3).map(el => ({
            tag: el.tagName,
            type: el.type || 'N/A',
            name: el.name || 'N/A',
            id: el.id || 'N/A',
            placeholder: el.placeholder || 'N/A',
            class: el.className || 'N/A'
        }));
        
        console.log('Available inputs on page:', inputInfo);
        
        throw new Error(`No suitable input field found. Tried selector: "${actionData.selector}". Found ${visibleInputs.length} visible input(s) on page.`);
    }
}

async function performSelect(actionData) {
    const element = document.querySelector(actionData.selector);
    
    if (element && element.tagName === 'SELECT') {
        highlightElement(element);
        
        element.value = actionData.value;
        
        const changeEvent = new Event('change', {
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(changeEvent);
        
        return { success: true };
    } else {
        throw new Error(`Select element not found: ${actionData.selector}`);
    }
}

async function performScroll(actionData) {
    const scrollAmount = actionData.amount || 300;
    const direction = actionData.direction || 'down';
    
    let scrollOptions = {
        behavior: 'smooth'
    };
    
    switch (direction) {
        case 'down':
            scrollOptions.top = window.scrollY + scrollAmount;
            break;
        case 'up':
            scrollOptions.top = window.scrollY - scrollAmount;
            break;
        case 'left':
            scrollOptions.left = window.scrollX - scrollAmount;
            break;
        case 'right':
            scrollOptions.left = window.scrollX + scrollAmount;
            break;
    }
    
    window.scrollTo(scrollOptions);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true };
}

async function performWait(actionData) {
    const duration = actionData.duration || 1000;
    await new Promise(resolve => setTimeout(resolve, duration));
    return { success: true };
}

async function performNavigate(actionData) {
    if (actionData.url) {
        window.location.href = actionData.url;
        // Note: This will cause a page navigation, so the script will stop here
        return { success: true, navigating: true };
    } else {
        throw new Error('Navigate action requires a URL');
    }
}

async function performPressEnter(actionData) {
    // Find the currently focused element or the last interacted input
    let targetElement = document.activeElement;
    
    // If no element is focused, try to find a visible form input
    if (!targetElement || targetElement === document.body) {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
        for (let input of inputs) {
            if (isElementVisible(input) && input.value && input.value.length > 0) {
                targetElement = input;
                break;
            }
        }
    }
    
    if (targetElement && targetElement !== document.body) {
        // Create and dispatch Enter key event
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        
        targetElement.dispatchEvent(enterEvent);
        
        // Also dispatch keypress and keyup for better compatibility
        const keypressEvent = new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        
        const keyupEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        
        targetElement.dispatchEvent(keypressEvent);
        targetElement.dispatchEvent(keyupEvent);
        
        // If it's a form input, also try to submit the form
        const form = targetElement.closest('form');
        if (form) {
            // Try to find and click a submit button first
            const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
            if (submitButton && isElementVisible(submitButton)) {
                submitButton.click();
            } else {
                // If no submit button, try to submit the form directly
                form.submit();
            }
        }
        
        return { success: true, element: 'Pressed Enter on ' + targetElement.tagName };
    } else {
        throw new Error('No active element to press Enter on');
    }
}

function highlightElement(element) {
    const originalBorder = element.style.border;
    const originalBackground = element.style.backgroundColor;
    
    element.style.border = '3px solid #667eea';
    element.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
    
    setTimeout(() => {
        element.style.border = originalBorder;
        element.style.backgroundColor = originalBackground;
    }, 1000);
}

function showActionOverlay(actionData) {
    // This will be handled by overlay.js
    window.postMessage({
        type: 'SHOW_ACTION_OVERLAY',
        action: actionData
    }, '*');
}

function cleanupOverlay() {
    window.postMessage({
        type: 'CLEANUP_OVERLAY'
    }, '*');
}

// Execute live mode actions (restricted to click, type, scroll, tap only)
async function executeLiveAction(actionData) {
    // IMPORTANT: Live mode can ONLY perform these actions:
    // - click/tap on elements
    // - type text
    // - scroll
    // NO code manipulation, NO DOM changes, NO JavaScript execution
    
    const allowedActions = ['click', 'tap', 'type', 'scroll'];
    
    if (!allowedActions.includes(actionData.type)) {
        throw new Error(`Action type '${actionData.type}' not allowed in live mode. Only click, tap, type, and scroll are permitted.`);
    }
    
    // Show visual feedback
    showActionOverlay(actionData);
    
    try {
        switch (actionData.type) {
            case 'click':
            case 'tap':
                return await performClick(actionData);
                
            case 'type':
                return await performType(actionData);
                
            case 'scroll':
                return await performScroll(actionData);
                
            default:
                throw new Error(`Invalid action type: ${actionData.type}`);
        }
    } catch (error) {
        console.error('Live action execution error:', error);
        return { success: false, error: error.message };
    }
}

// Inject html2canvas library if needed
if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => console.log('html2canvas loaded');
    document.head.appendChild(script);
}