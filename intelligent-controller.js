// Intelligent Controller - Advanced Content Script
// Works with AI Brain System for comprehensive browser control

(function() {
    console.log('🎯 Intelligent Controller initialized');
    
    // Page analysis and state tracking
    const pageState = {
        url: window.location.href,
        title: document.title,
        elements: {
            buttons: [],
            links: [],
            inputs: [],
            images: [],
            videos: []
        },
        metrics: {
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
            domElements: document.getElementsByTagName('*').length,
            images: document.images.length,
            forms: document.forms.length
        },
        interactions: [],
        mutations: []
    };
    
    // Element finder with multiple strategies
    class ElementFinder {
        constructor() {
            this.strategies = [
                this.findBySelector,
                this.findByText,
                this.findByAriaLabel,
                this.findByPlaceholder,
                this.findByNearbyText,
                this.findByVisualPosition,
                this.findBySemanticRole
            ];
        }
        
        async find(descriptor) {
            console.log('Finding element:', descriptor);
            
            for (const strategy of this.strategies) {
                try {
                    const element = await strategy.call(this, descriptor);
                    if (element && this.isInteractable(element)) {
                        console.log('Found element with strategy:', strategy.name);
                        return element;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return null;
        }
        
        findBySelector(descriptor) {
            try {
                return document.querySelector(descriptor);
            } catch (e) {
                return null;
            }
        }
        
        findByText(descriptor) {
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
                const text = el.textContent || el.value || '';
                if (text.toLowerCase().includes(descriptor.toLowerCase())) {
                    if (this.isClickable(el)) {
                        return el;
                    }
                }
            }
            return null;
        }
        
        findByAriaLabel(descriptor) {
            return document.querySelector(`[aria-label*="${descriptor}" i]`);
        }
        
        findByPlaceholder(descriptor) {
            return document.querySelector(`[placeholder*="${descriptor}" i]`);
        }
        
        findByNearbyText(descriptor) {
            const allText = document.body.innerText.toLowerCase();
            const index = allText.indexOf(descriptor.toLowerCase());
            
            if (index !== -1) {
                // Find element near this text
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue && node.nodeValue.toLowerCase().includes(descriptor.toLowerCase())) {
                        // Check parent and siblings for clickable elements
                        const parent = node.parentElement;
                        if (parent) {
                            const clickable = parent.querySelector('button, a, input, [role="button"]');
                            if (clickable) return clickable;
                        }
                    }
                }
            }
            
            return null;
        }
        
        findByVisualPosition(descriptor) {
            // Find by position descriptions like "top right", "center", etc
            const positions = {
                'top': { y: 0.2 },
                'middle': { y: 0.5 },
                'bottom': { y: 0.8 },
                'left': { x: 0.2 },
                'center': { x: 0.5 },
                'right': { x: 0.8 }
            };
            
            for (const [key, pos] of Object.entries(positions)) {
                if (descriptor.toLowerCase().includes(key)) {
                    const x = pos.x ? window.innerWidth * pos.x : window.innerWidth / 2;
                    const y = pos.y ? window.innerHeight * pos.y : window.innerHeight / 2;
                    const element = document.elementFromPoint(x, y);
                    if (element && this.isClickable(element)) {
                        return element;
                    }
                }
            }
            
            return null;
        }
        
        findBySemanticRole(descriptor) {
            const roles = ['button', 'link', 'textbox', 'searchbox', 'navigation'];
            for (const role of roles) {
                if (descriptor.toLowerCase().includes(role)) {
                    return document.querySelector(`[role="${role}"]`);
                }
            }
            return null;
        }
        
        isInteractable(element) {
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0' &&
                   !element.disabled;
        }
        
        isClickable(element) {
            const clickableTags = ['a', 'button', 'input', 'select', 'textarea'];
            const tag = element.tagName.toLowerCase();
            
            return clickableTags.includes(tag) ||
                   element.onclick ||
                   element.getAttribute('role') === 'button' ||
                   window.getComputedStyle(element).cursor === 'pointer';
        }
    }
    
    const elementFinder = new ElementFinder();
    
    // Message handler
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sendResponse);
        return true;
    });
    
    async function handleMessage(request, sendResponse) {
        console.log('Message received:', request.action);
        
        try {
            switch (request.action) {
                case 'PING':
                    sendResponse({ success: true });
                    break;
                    
                case 'GET_PAGE_INFO':
                    sendResponse(getPageInfo());
                    break;
                    
                case 'CLICK':
                    const clickResult = await clickElement(request.selector);
                    sendResponse(clickResult);
                    break;
                    
                case 'TYPE':
                    const typeResult = await typeText(request.selector, request.text);
                    sendResponse(typeResult);
                    break;
                    
                case 'SCROLL':
                    const scrollResult = await scrollPage(request);
                    sendResponse(scrollResult);
                    break;
                    
                case 'EXTRACT':
                    const extractResult = await extractData(request);
                    sendResponse(extractResult);
                    break;
                    
                case 'OBSERVE':
                    startObserving(request.options);
                    sendResponse({ success: true });
                    break;
                    
                case 'HIGHLIGHT':
                    highlightElement(request.selector);
                    sendResponse({ success: true });
                    break;
                    
                case 'SCREENSHOT_REGION':
                    const screenshot = await captureRegion(request.selector);
                    sendResponse({ success: true, data: screenshot });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Action failed:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    function getPageInfo() {
        // Analyze page structure
        const info = {
            url: window.location.href,
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content,
            
            // Forms
            forms: Array.from(document.forms).map(form => ({
                action: form.action,
                method: form.method,
                fields: Array.from(form.elements).map(el => ({
                    type: el.type,
                    name: el.name,
                    id: el.id,
                    required: el.required
                }))
            })),
            
            // Interactive elements
            buttons: Array.from(document.querySelectorAll('button, [role="button"]')).map(btn => ({
                text: btn.textContent?.trim(),
                type: btn.type,
                selector: generateSelector(btn)
            })),
            
            links: Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(link => ({
                text: link.textContent?.trim(),
                href: link.href,
                selector: generateSelector(link)
            })),
            
            inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
                type: input.type,
                name: input.name,
                placeholder: input.placeholder,
                selector: generateSelector(input)
            })),
            
            // Media
            images: Array.from(document.images).slice(0, 10).map(img => ({
                src: img.src,
                alt: img.alt,
                selector: generateSelector(img)
            })),
            
            // Page state
            hasScrollbar: document.documentElement.scrollHeight > window.innerHeight,
            scrollPosition: window.scrollY,
            documentHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            
            // Performance
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
            domElements: document.getElementsByTagName('*').length
        };
        
        return info;
    }
    
    async function clickElement(selector) {
        const element = await elementFinder.find(selector);
        
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }
        
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        
        // Highlight before clicking
        highlightElement(element);
        
        // Simulate human-like click
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Dispatch mouse events
        element.dispatchEvent(new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        }));
        
        await sleep(50);
        
        element.dispatchEvent(new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        }));
        
        element.click();
        
        // Record interaction
        pageState.interactions.push({
            type: 'click',
            selector: generateSelector(element),
            timestamp: Date.now()
        });
        
        return { success: true, message: 'Clicked successfully' };
    }
    
    async function typeText(selector, text) {
        const element = await elementFinder.find(selector);
        
        if (!element) {
            throw new Error(`Input not found: ${selector}`);
        }
        
        // Focus element
        element.focus();
        element.click();
        
        // Clear if needed
        if (element.value) {
            element.select();
            document.execCommand('delete');
        }
        
        // Type character by character
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50 + Math.random() * 50); // Human-like typing speed
        }
        
        // Dispatch change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Record interaction
        pageState.interactions.push({
            type: 'type',
            selector: generateSelector(element),
            value: text,
            timestamp: Date.now()
        });
        
        return { success: true, message: 'Typed successfully' };
    }
    
    async function scrollPage(options) {
        const direction = options.direction || 'down';
        const amount = options.amount || 500;
        const smooth = options.smooth !== false;
        
        window.scrollBy({
            top: direction === 'up' ? -amount : amount,
            left: 0,
            behavior: smooth ? 'smooth' : 'auto'
        });
        
        await sleep(500);
        
        return { 
            success: true, 
            scrollPosition: window.scrollY,
            maxScroll: document.documentElement.scrollHeight - window.innerHeight
        };
    }
    
    async function extractData(options) {
        const data = {};
        
        if (options.selectors) {
            for (const [key, selector] of Object.entries(options.selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    data[key] = element.textContent?.trim() || element.value || '';
                }
            }
        }
        
        if (options.all) {
            data.all = document.body.innerText;
        }
        
        if (options.tables) {
            data.tables = Array.from(document.querySelectorAll('table')).map(table => {
                const rows = Array.from(table.rows);
                return rows.map(row => Array.from(row.cells).map(cell => cell.textContent?.trim()));
            });
        }
        
        return { success: true, data };
    }
    
    function startObserving(options) {
        // Observe DOM changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                pageState.mutations.push({
                    type: mutation.type,
                    target: generateSelector(mutation.target),
                    timestamp: Date.now()
                });
            });
            
            // Send updates to background
            if (pageState.mutations.length > 10) {
                chrome.runtime.sendMessage({
                    type: 'DOM_CHANGES',
                    data: pageState.mutations
                });
                pageState.mutations = [];
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true
        });
        
        // Store observer for cleanup
        window.__observer = observer;
    }
    
    function highlightElement(selector) {
        let element = selector;
        if (typeof selector === 'string') {
            element = document.querySelector(selector);
        }
        
        if (!element) return;
        
        const originalStyle = {
            outline: element.style.outline,
            boxShadow: element.style.boxShadow,
            background: element.style.background
        };
        
        element.style.outline = '3px solid #FF6B6B';
        element.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.5)';
        element.style.background = 'rgba(255, 107, 107, 0.1)';
        
        setTimeout(() => {
            Object.assign(element.style, originalStyle);
        }, 2000);
    }
    
    async function captureRegion(selector) {
        const element = await elementFinder.find(selector);
        if (!element) return null;
        
        const rect = element.getBoundingClientRect();
        
        // Use html2canvas if available, otherwise return bounds
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }
    
    function generateSelector(element) {
        if (!element) return '';
        
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c).join('.');
            if (classes) {
                const selector = `${element.tagName.toLowerCase()}.${classes}`;
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }
        
        // Generate path
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                selector = `#${current.id}`;
                path.unshift(selector);
                break;
            }
            
            const siblings = Array.from(current.parentNode?.children || []);
            const index = siblings.indexOf(current);
            
            if (siblings.length > 1) {
                selector += `:nth-child(${index + 1})`;
            }
            
            path.unshift(selector);
            current = current.parentNode;
        }
        
        return path.join(' > ');
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Initialize page analysis
    function initializePageAnalysis() {
        // Capture initial page state
        pageState.elements.buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        pageState.elements.links = Array.from(document.querySelectorAll('a[href]'));
        pageState.elements.inputs = Array.from(document.querySelectorAll('input, textarea, select'));
        pageState.elements.images = Array.from(document.images);
        pageState.elements.videos = Array.from(document.querySelectorAll('video'));
        
        console.log('Page analysis complete:', pageState);
    }
    
    // Run initialization
    initializePageAnalysis();
    
    // Notify background that content script is ready
    chrome.runtime.sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        data: pageState
    }).catch(() => {});
    
    console.log('✅ Intelligent Controller ready');
})();