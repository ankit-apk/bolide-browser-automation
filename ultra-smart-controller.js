// Ultra-Smart Browser Controller with Advanced Capabilities
// Visual understanding, intelligent element finding, and adaptive behavior

(function() {
    // Check if already initialized
    if (window.__ultraSmartController) {
        console.log('🔄 Ultra-Smart Controller already exists, cleaning up...');
        window.__ultraSmartController.cleanup();
    }

    console.log('🧠 Ultra-Smart Browser Controller initializing...');

    // Global state for intelligent behavior
    const state = {
        lastAction: null,
        actionHistory: [],
        elementCache: new Map(),
        pageState: 'ready',
        observedElements: new Set()
    };

    // Store message listener for cleanup
    let messageListener = null;

    // Message handling
    messageListener = (request, sender, sendResponse) => {
        handleMessage(request, sender, sendResponse);
        return true;
    };
    
    chrome.runtime.onMessage.addListener(messageListener);

    async function handleMessage(request, sender, sendResponse) {
        console.log('📨 Ultra-Smart Controller received:', request.action);
        
        switch (request.action) {
            case 'PING':
                sendResponse({ 
                    success: true, 
                    message: 'Ultra-Smart Controller ready',
                    capabilities: ['visual', 'semantic', 'adaptive']
                });
                break;
                
            case 'EXECUTE_ACTION':
                const result = await executeUltraSmartAction(request.data);
                sendResponse(result);
                break;
                
            case 'ANALYZE_PAGE':
                const analysis = await analyzePage();
                sendResponse(analysis);
                break;
                
            case 'GET_VISUAL_INFO':
                const visualInfo = await getVisualInfo(request.data);
                sendResponse(visualInfo);
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    // Ultra-smart action execution
    async function executeUltraSmartAction(action) {
        console.log('🎬 Ultra-Smart Execution:', action);
        
        try {
            // Show intelligent feedback
            showSmartFeedback(action);
            
            // Record action for learning
            state.lastAction = action;
            state.actionHistory.push({
                action: action,
                timestamp: Date.now(),
                pageUrl: window.location.href
            });
            
            let result;
            const actionType = action.type || action.action;
            
            switch (actionType) {
                case 'click':
                    result = await ultraSmartClick(action);
                    break;
                    
                case 'type':
                    result = await ultraSmartType(action);
                    break;
                    
                case 'navigate':
                    result = await navigateSmart(action.url);
                    break;
                    
                case 'scroll':
                    result = await smartScroll(action);
                    break;
                    
                case 'wait':
                    result = await intelligentWait(action);
                    break;
                    
                case 'hover':
                    result = await hoverSmart(action);
                    break;
                    
                case 'press':
                case 'key':
                case 'keypress':
                    result = await pressKeySmart(action.key || action.value || 'Enter');
                    break;
                    
                case 'visual_click':
                    result = await visualClick(action);
                    break;
                    
                case 'extract':
                    result = await extractInfo(action);
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${actionType}`);
            }
            
            console.log('✅ Ultra-Smart Action succeeded:', result);
            return { success: true, ...result, confidence: result.confidence || 1.0 };
            
        } catch (error) {
            console.error('❌ Ultra-Smart Action failed:', error);
            
            // Intelligent error analysis
            const errorAnalysis = analyzeError(error, action);
            return { 
                success: false, 
                error: error.message,
                analysis: errorAnalysis,
                suggestions: getSuggestions(errorAnalysis)
            };
        }
    }

    // Ultra-smart click with multiple strategies
    async function ultraSmartClick(action) {
        console.log('🖱️ Ultra-Smart Click:', action);
        
        // Gmail-specific click handling
        if (window.location.hostname.includes('mail.google.com')) {
            // Try to click unread email
            if (action.selector.includes('zE') || action.selector.includes('unread')) {
                const unreadEmails = document.querySelectorAll('tr.zA.zE');
                if (unreadEmails.length > 0) {
                    console.log('Clicking first unread email');
                    await ensureElementReady(unreadEmails[0]);
                    highlightElement(unreadEmails[0], 'click');
                    unreadEmails[0].click();
                    return { 
                        message: 'Clicked unread email',
                        selector: action.selector,
                        confidence: 0.9
                    };
                }
            }
            
            // Try clicking show search options
            if (action.selector.includes('Show search options')) {
                const searchButton = document.querySelector('button[aria-label="Advanced search options"]') ||
                                   document.querySelector('div[data-tooltip="Show search options"]') ||
                                   document.querySelector('button[aria-label="Search options"]');
                if (searchButton) {
                    console.log('Clicking search options button');
                    await ensureElementReady(searchButton);
                    highlightElement(searchButton, 'click');
                    searchButton.click();
                    return { 
                        message: 'Clicked search options',
                        selector: action.selector,
                        confidence: 0.9
                    };
                }
            }
        }
        
        // Try multiple strategies in parallel
        const strategies = action.strategies || [
            { method: 'selector', value: action.selector },
            { method: 'text', value: action.selector },
            { method: 'visual', value: action.selector },
            { method: 'semantic', value: action.selector }
        ];
        
        let element = null;
        let successfulStrategy = null;
        
        for (const strategy of strategies) {
            element = await findElementByStrategy(strategy);
            if (element) {
                successfulStrategy = strategy.method;
                break;
            }
        }
        
        if (!element) {
            // Last resort: find clickable elements and match
            element = await findClickableByContext(action.selector);
        }
        
        if (!element) {
            throw new Error(`Cannot find element: ${action.selector}`);
        }
        
        // Ensure element is ready for interaction
        await ensureElementReady(element);
        
        // Visual highlight
        highlightElement(element, 'click');
        
        // Smart click with fallbacks
        await performSmartClick(element);
        
        return { 
            message: `Clicked using ${successfulStrategy}`,
            selector: action.selector,
            confidence: successfulStrategy === 'selector' ? 1.0 : 0.8
        };
    }

    // Find element by strategy
    async function findElementByStrategy(strategy) {
        switch (strategy.method) {
            case 'selector':
                return findBySelector(strategy.value);
                
            case 'text':
                return findByText(strategy.value);
                
            case 'visual':
                return findByVisualDescription(strategy.value);
                
            case 'semantic':
                return findBySemantic(strategy.value);
                
            case 'coordinates':
                return findByCoordinates(strategy.x, strategy.y);
                
            default:
                return null;
        }
    }

    // Find by CSS selector with validation
    function findBySelector(selector) {
        try {
            // Handle common Google Search selectors
            if (selector === "input[name='q']" || selector === "[name='q']") {
                // Google Search specific handling
                const searchInputs = document.querySelectorAll('input[name="q"], textarea[name="q"], input[title="Search"], input[aria-label="Search"]');
                for (const input of searchInputs) {
                    if (isElementUsable(input)) {
                        console.log('Found Google search input');
                        return input;
                    }
                }
            }
            
            // Gmail specific selectors
            if (window.location.hostname.includes('mail.google.com')) {
                // Handle Gmail search
                if (selector.includes('Search mail')) {
                    const searchBox = document.querySelector('input[placeholder="Search mail"]') ||
                                     document.querySelector('input[aria-label="Search mail"]') ||
                                     document.querySelector('input[name="q"]');
                    if (searchBox && isElementUsable(searchBox)) {
                        console.log('Found Gmail search box');
                        return searchBox;
                    }
                }
                
                // Handle Gmail unread emails
                if (selector === '.zE' || selector === '.zE:first-child') {
                    // Find unread emails (with bold text)
                    const unreadEmails = document.querySelectorAll('tr.zA.zE');
                    if (unreadEmails.length > 0) {
                        console.log('Found unread emails:', unreadEmails.length);
                        return unreadEmails[0];
                    }
                }
                
                // Handle email rows
                if (selector.includes('tr:has(b)') || selector.includes('oZ-x3')) {
                    const emailRows = document.querySelectorAll('tr.zA');
                    for (const row of emailRows) {
                        // Check if row has bold text (unread)
                        const hasBold = row.querySelector('span.bqe') || row.classList.contains('zE');
                        if (hasBold && isElementUsable(row)) {
                            console.log('Found unread email row');
                            return row;
                        }
                    }
                }
            }
            
            const element = document.querySelector(selector);
            if (element && isElementUsable(element)) {
                return element;
            }
        } catch (e) {
            console.error('Selector error:', e);
        }
        return null;
    }

    // Find by text content with fuzzy matching
    function findByText(text) {
        const allElements = document.querySelectorAll('*');
        const candidates = [];
        
        for (const el of allElements) {
            if (!isElementUsable(el)) continue;
            
            const elementText = getElementText(el);
            if (!elementText) continue;
            
            const similarity = calculateSimilarity(elementText, text);
            if (similarity > 0.7) {
                candidates.push({ element: el, score: similarity });
            }
        }
        
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0].element;
        }
        
        return null;
    }

    // Find by visual description
    function findByVisualDescription(description) {
        // Examples: "blue button", "large text", "center of page"
        const desc = description.toLowerCase();
        
        if (desc.includes('button')) {
            const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
            
            for (const btn of buttons) {
                const style = window.getComputedStyle(btn);
                
                if (desc.includes('blue') && style.backgroundColor.includes('blue')) {
                    return btn;
                }
                if (desc.includes('large') && parseInt(style.fontSize) > 16) {
                    return btn;
                }
                if (desc.includes('primary') && btn.classList.toString().includes('primary')) {
                    return btn;
                }
            }
        }
        
        if (desc.includes('center')) {
            return findElementInCenter();
        }
        
        return null;
    }

    // Find by semantic meaning
    function findBySemantic(semantic) {
        const semanticMap = {
            'search': ['search', 'find', 'query', 'look'],
            'submit': ['submit', 'send', 'post', 'save', 'confirm'],
            'cancel': ['cancel', 'close', 'dismiss', 'back'],
            'next': ['next', 'continue', 'forward', 'proceed'],
            'login': ['login', 'sign in', 'log in', 'signin']
        };
        
        for (const [key, synonyms] of Object.entries(semanticMap)) {
            if (synonyms.some(syn => semantic.toLowerCase().includes(syn))) {
                // Find elements matching this semantic meaning
                const elements = document.querySelectorAll('*');
                
                for (const el of elements) {
                    const text = getElementText(el).toLowerCase();
                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    
                    if (synonyms.some(syn => text.includes(syn) || ariaLabel.includes(syn))) {
                        if (isElementUsable(el)) {
                            return el;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    // Find element in center of viewport
    function findElementInCenter() {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        const element = document.elementFromPoint(centerX, centerY);
        
        if (element && element.tagName !== 'BODY' && element.tagName !== 'HTML') {
            // Find nearest clickable parent
            let current = element;
            while (current) {
                if (isClickable(current)) {
                    return current;
                }
                current = current.parentElement;
            }
        }
        
        return null;
    }

    // Ultra-smart type with context understanding
    async function ultraSmartType(action) {
        let element = await findInputElement(action.selector);
        
        if (!element) {
            throw new Error(`Cannot find input: ${action.selector}`);
        }
        
        await ensureElementReady(element);
        highlightElement(element, 'type');
        
        // Smart focus - especially important for Google Search
        element.focus();
        await sleep(100);
        
        // Click to ensure activation
        element.click();
        await sleep(100);
        
        // For Google Search, sometimes we need to click twice
        if (element.name === 'q' && !element.value) {
            element.click();
            await sleep(100);
        }
        
        // Clear if needed
        if (action.clear !== false) {
            element.value = '';
            element.select && element.select();
            
            // Dispatch clear events
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Type with realistic timing
        await typeWithDelay(element, action.text);
        
        // Trigger all events
        ['input', 'change', 'keyup'].forEach(event => {
            element.dispatchEvent(new Event(event, { bubbles: true }));
        });
        
        // Special handling for search inputs - trigger search suggestions
        if (element.name === 'q' || element.type === 'search') {
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: action.text.slice(-1),
                bubbles: true
            }));
        }
        
        return { 
            message: `Typed: ${action.text}`,
            confidence: 0.95
        };
    }

    // Find input element with context
    async function findInputElement(selector) {
        // Gmail-specific search box
        if (window.location.hostname.includes('mail.google.com') && 
            (selector.includes('Search') || selector.includes('search'))) {
            const gmailSearch = document.querySelector('input[placeholder="Search mail"]') ||
                               document.querySelector('input[aria-label="Search mail"]') ||
                               document.querySelector('form[role="search"] input') ||
                               document.querySelector('input[name="q"]');
            if (gmailSearch && isElementUsable(gmailSearch)) {
                console.log('Found Gmail search box directly');
                return gmailSearch;
            }
        }
        
        // Try direct selector
        let element = findBySelector(selector);
        if (element) return element;
        
        // Find by placeholder or label
        const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
        
        for (const input of inputs) {
            if (!isElementUsable(input)) continue;
            
            // Check placeholder
            if (input.placeholder && calculateSimilarity(input.placeholder, selector) > 0.7) {
                return input;
            }
            
            // Check label
            const label = findLabelForInput(input);
            if (label && calculateSimilarity(getElementText(label), selector) > 0.7) {
                return input;
            }
            
            // Check aria-label
            if (input.getAttribute('aria-label') && 
                calculateSimilarity(input.getAttribute('aria-label'), selector) > 0.7) {
                return input;
            }
        }
        
        return null;
    }

    // Type with realistic delay
    async function typeWithDelay(element, text) {
        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50 + Math.random() * 50); // 50-100ms per character
        }
    }

    // Smart navigation
    async function navigateSmart(url) {
        console.log('🌐 Smart Navigation to:', url);
        
        // Intelligent URL processing
        let processedUrl = url;
        
        // Add protocol if missing
        if (!url.startsWith('http')) {
            processedUrl = 'https://' + url;
        }
        
        // Handle common shortcuts
        const shortcuts = {
            'maps': 'https://maps.google.com',
            'gmail': 'https://mail.google.com',
            'youtube': 'https://youtube.com',
            'drive': 'https://drive.google.com'
        };
        
        for (const [key, fullUrl] of Object.entries(shortcuts)) {
            if (url.toLowerCase() === key) {
                processedUrl = fullUrl;
                break;
            }
        }
        
        window.location.href = processedUrl;
        return { 
            message: `Navigating to: ${processedUrl}`,
            confidence: 1.0
        };
    }

    // Intelligent wait
    async function intelligentWait(action) {
        const waitTime = action.wait || action.time || 2000;
        
        if (action.waitFor) {
            // Wait for specific condition
            return await waitForCondition(action.waitFor, waitTime);
        }
        
        // Smart wait - check for page activity
        const startTime = Date.now();
        let lastActivity = Date.now();
        
        const observer = new MutationObserver(() => {
            lastActivity = Date.now();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        while (Date.now() - startTime < waitTime) {
            await sleep(100);
            
            // If no activity for 500ms, consider page stable
            if (Date.now() - lastActivity > 500) {
                break;
            }
        }
        
        observer.disconnect();
        
        return { 
            message: `Waited intelligently for ${Date.now() - startTime}ms`,
            confidence: 0.9
        };
    }

    // Wait for condition
    async function waitForCondition(condition, maxTime) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxTime) {
            if (evaluateCondition(condition)) {
                return { 
                    message: `Condition met: ${condition}`,
                    confidence: 1.0
                };
            }
            await sleep(100);
        }
        
        throw new Error(`Timeout waiting for: ${condition}`);
    }

    // Analyze page structure
    async function analyzePage() {
        const analysis = {
            pageType: detectPageType(),
            interactiveElements: findInteractiveElements(),
            forms: findForms(),
            navigation: findNavigation(),
            state: detectPageState(),
            mainContent: findMainContent()
        };
        
        console.log('📊 Page Analysis:', analysis);
        return analysis;
    }

    // Detect page type
    function detectPageType() {
        const url = window.location.href;
        const title = document.title.toLowerCase();
        const body = document.body.textContent.toLowerCase();
        
        if (url.includes('search') || title.includes('search')) return 'search';
        if (url.includes('login') || url.includes('signin')) return 'login';
        if (url.includes('checkout') || url.includes('cart')) return 'checkout';
        if (url.includes('maps')) return 'maps';
        if (document.querySelector('form')) return 'form';
        
        return 'general';
    }

    // Find interactive elements
    function findInteractiveElements() {
        const interactive = [];
        
        // Buttons
        document.querySelectorAll('button, [role="button"]').forEach(el => {
            if (isElementUsable(el)) {
                interactive.push({
                    type: 'button',
                    text: getElementText(el),
                    selector: generateSelector(el)
                });
            }
        });
        
        // Links
        document.querySelectorAll('a[href]').forEach(el => {
            if (isElementUsable(el)) {
                interactive.push({
                    type: 'link',
                    text: getElementText(el),
                    href: el.href,
                    selector: generateSelector(el)
                });
            }
        });
        
        // Inputs
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (isElementUsable(el)) {
                interactive.push({
                    type: el.tagName.toLowerCase(),
                    placeholder: el.placeholder,
                    name: el.name,
                    selector: generateSelector(el)
                });
            }
        });
        
        return interactive;
    }

    // Helper functions
    function getElementText(element) {
        return (element.textContent || element.value || element.innerText || '').trim();
    }

    function isElementUsable(element) {
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

    function isClickable(element) {
        const clickableTags = ['a', 'button', 'input', 'select'];
        const tag = element.tagName.toLowerCase();
        
        return clickableTags.includes(tag) ||
               element.onclick ||
               element.getAttribute('role') === 'button' ||
               window.getComputedStyle(element).cursor === 'pointer';
    }

    function calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        if (s1 === s2) return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        // Calculate Levenshtein distance
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const distance = matrix[s2.length][s1.length];
        const maxLength = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLength);
    }

    function generateSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c).join('.');
            if (classes) return `.${classes}`;
        }
        return element.tagName.toLowerCase();
    }

    async function ensureElementReady(element) {
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        
        // Wait for any animations
        const transition = window.getComputedStyle(element).transition;
        if (transition && transition !== 'none') {
            await sleep(500);
        }
    }

    async function performSmartClick(element) {
        // Try native click
        try {
            element.click();
        } catch (e) {
            // Fallback to event dispatch
            const events = ['mousedown', 'mouseup', 'click'];
            for (const eventType of events) {
                element.dispatchEvent(new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    buttons: 1
                }));
            }
        }
    }

    function findLabelForInput(input) {
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }
        return input.closest('label');
    }

    function analyzeError(error, action) {
        const analysis = {
            errorType: error.name,
            likelyCause: '',
            elementMissing: false,
            pageNotReady: false
        };
        
        if (error.message.includes('Cannot find')) {
            analysis.elementMissing = true;
            analysis.likelyCause = 'Element not found on page';
        } else if (error.message.includes('timeout')) {
            analysis.pageNotReady = true;
            analysis.likelyCause = 'Page took too long to load';
        }
        
        return analysis;
    }

    function getSuggestions(analysis) {
        const suggestions = [];
        
        if (analysis.elementMissing) {
            suggestions.push('Try a different selector');
            suggestions.push('Wait for page to fully load');
            suggestions.push('Check if element is in a frame');
        }
        
        if (analysis.pageNotReady) {
            suggestions.push('Increase wait time');
            suggestions.push('Check network connection');
        }
        
        return suggestions;
    }

    function showSmartFeedback(action) {
        const feedback = document.createElement('div');
        feedback.className = 'ultra-smart-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            font-family: -apple-system, system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 2147483647;
            animation: slideIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 350px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icon = document.createElement('span');
        icon.style.fontSize = '20px';
        icon.textContent = getActionIcon(action.type || action.action);
        
        const text = document.createElement('span');
        text.textContent = `${action.type || action.action}: ${action.selector || action.url || ''}`;
        
        feedback.appendChild(icon);
        feedback.appendChild(text);
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { 
                    transform: translateX(400px) scale(0.8); 
                    opacity: 0; 
                }
                to { 
                    transform: translateX(0) scale(1); 
                    opacity: 1; 
                }
            }
            @keyframes slideOut {
                from { 
                    transform: translateX(0) scale(1); 
                    opacity: 1; 
                }
                to { 
                    transform: translateX(400px) scale(0.8); 
                    opacity: 0; 
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(feedback);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }

    function getActionIcon(action) {
        const icons = {
            'click': '🖱️',
            'type': '⌨️',
            'navigate': '🌐',
            'scroll': '📜',
            'wait': '⏳',
            'hover': '👆',
            'press': '⏎',
            'visual_click': '👁️',
            'extract': '📋'
        };
        return icons[action] || '⚡';
    }

    function highlightElement(element, action) {
        const colors = {
            'click': '#667eea',
            'type': '#48bb78',
            'hover': '#ed8936'
        };
        
        const color = colors[action] || '#667eea';
        
        const originalStyle = {
            outline: element.style.outline,
            boxShadow: element.style.boxShadow,
            backgroundColor: element.style.backgroundColor,
            transform: element.style.transform
        };
        
        element.style.outline = `3px solid ${color}`;
        element.style.boxShadow = `0 0 30px ${color}40`;
        element.style.backgroundColor = `${color}10`;
        element.style.transform = 'scale(1.02)';
        element.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            Object.assign(element.style, originalStyle);
        }, 2000);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Additional smart functions
    async function smartScroll(action) {
        const direction = action.direction || 'down';
        const amount = action.amount || 500;
        
        window.scrollBy({
            top: direction === 'up' ? -amount : amount,
            left: 0,
            behavior: 'smooth'
        });
        
        await sleep(500);
        return { message: `Scrolled ${direction} ${amount}px` };
    }

    async function hoverSmart(action) {
        const element = await findElementByStrategy({ method: 'selector', value: action.selector });
        if (!element) throw new Error('Element not found');
        
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        
        return { message: `Hovered over ${action.selector}` };
    }

    async function pressKeySmart(key) {
        const activeElement = document.activeElement || document.body;
        console.log('Pressing key:', key, 'on element:', activeElement.tagName, activeElement.name);
        
        // Map common key names
        const keyMap = {
            'enter': 'Enter',
            'return': 'Enter',
            'tab': 'Tab',
            'escape': 'Escape',
            'esc': 'Escape',
            'space': ' ',
            'backspace': 'Backspace'
        };
        
        const normalizedKey = keyMap[key.toLowerCase()] || key;
        
        // For Enter key on search inputs, submit the form if available
        if (normalizedKey === 'Enter' && activeElement.tagName === 'INPUT') {
            const form = activeElement.closest('form');
            if (form) {
                console.log('Submitting form for Enter key');
                form.submit();
                return { message: `Submitted form with Enter key` };
            }
        }
        
        const keyEvent = new KeyboardEvent('keydown', {
            key: normalizedKey,
            code: normalizedKey === 'Enter' ? 'Enter' : normalizedKey,
            keyCode: normalizedKey === 'Enter' ? 13 : normalizedKey.charCodeAt(0),
            which: normalizedKey === 'Enter' ? 13 : normalizedKey.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });
        
        activeElement.dispatchEvent(keyEvent);
        
        // Also dispatch keypress for Enter
        if (normalizedKey === 'Enter') {
            activeElement.dispatchEvent(new KeyboardEvent('keypress', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
        }
        
        activeElement.dispatchEvent(new KeyboardEvent('keyup', {
            key: normalizedKey,
            code: normalizedKey === 'Enter' ? 'Enter' : normalizedKey,
            keyCode: normalizedKey === 'Enter' ? 13 : normalizedKey.charCodeAt(0),
            which: normalizedKey === 'Enter' ? 13 : normalizedKey.charCodeAt(0),
            bubbles: true
        }));
        
        return { message: `Pressed ${normalizedKey}` };
    }

    function detectPageState() {
        // Check for loading indicators
        const loadingIndicators = document.querySelectorAll('.loading, .spinner, [class*="load"]');
        if (loadingIndicators.length > 0) return 'loading';
        
        // Check for error messages
        const errorIndicators = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
        if (errorIndicators.length > 0) return 'error';
        
        // Check for success messages
        const successIndicators = document.querySelectorAll('.success, .alert-success, [class*="success"]');
        if (successIndicators.length > 0) return 'success';
        
        return 'ready';
    }

    function findForms() {
        const forms = [];
        document.querySelectorAll('form').forEach(form => {
            const fields = [];
            form.querySelectorAll('input, textarea, select').forEach(field => {
                fields.push({
                    type: field.type,
                    name: field.name,
                    placeholder: field.placeholder,
                    required: field.required
                });
            });
            
            forms.push({
                action: form.action,
                method: form.method,
                fields: fields
            });
        });
        
        return forms;
    }

    function findNavigation() {
        const nav = [];
        document.querySelectorAll('nav, [role="navigation"], .nav, .menu').forEach(navEl => {
            navEl.querySelectorAll('a').forEach(link => {
                nav.push({
                    text: getElementText(link),
                    href: link.href
                });
            });
        });
        
        return nav;
    }

    function findMainContent() {
        const main = document.querySelector('main, [role="main"], #content, .content');
        if (main) {
            return {
                text: main.textContent.substring(0, 500),
                hasImages: main.querySelectorAll('img').length,
                hasVideos: main.querySelectorAll('video').length
            };
        }
        return null;
    }

    function evaluateCondition(condition) {
        // Simple condition evaluation
        if (condition.includes('visible')) {
            const selector = condition.replace('visible:', '').trim();
            const element = document.querySelector(selector);
            return element && isElementUsable(element);
        }
        
        if (condition.includes('text:')) {
            const text = condition.replace('text:', '').trim();
            return document.body.textContent.includes(text);
        }
        
        return false;
    }

    function findClickableByContext(context) {
        // Find clickable elements near text that matches context
        const allText = document.querySelectorAll('*');
        
        for (const el of allText) {
            if (getElementText(el).toLowerCase().includes(context.toLowerCase())) {
                // Check if this element is clickable
                if (isClickable(el)) return el;
                
                // Check nearby clickable elements
                const nearbyClickables = el.querySelectorAll('button, a, [role="button"]');
                if (nearbyClickables.length > 0) {
                    return nearbyClickables[0];
                }
            }
        }
        
        return null;
    }

    async function visualClick(action) {
        // Click based on visual description
        const element = findByVisualDescription(action.description);
        if (!element) throw new Error('Visual element not found');
        
        await performSmartClick(element);
        return { message: `Visually clicked: ${action.description}` };
    }

    async function extractInfo(action) {
        // Extract information from the page
        const info = {};
        
        if (action.fields) {
            action.fields.forEach(field => {
                const element = document.querySelector(field.selector);
                if (element) {
                    info[field.name] = getElementText(element);
                }
            });
        }
        
        return { extracted: info };
    }

    function findByCoordinates(x, y) {
        return document.elementFromPoint(x, y);
    }

    // Expose controller for cleanup
    window.__ultraSmartController = {
        cleanup: function() {
            console.log('🧹 Cleaning up Ultra-Smart Controller...');
            if (messageListener) {
                chrome.runtime.onMessage.removeListener(messageListener);
            }
        },
        state: state,
        version: '2.0'
    };

    console.log('✅ Ultra-Smart Browser Controller ready with advanced capabilities (v2.0)');
})();