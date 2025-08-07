// Overlay script for visual feedback during automation
(function() {
    let overlayContainer = null;
    let actionDisplay = null;
    let progressIndicator = null;
    let currentActionTimeout = null;

    // Initialize overlay components
    function initOverlay() {
        if (overlayContainer) return;

        // Create main overlay container
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'ai-automation-overlay';
        overlayContainer.className = 'ai-overlay-container';
        
        // Create action display panel
        actionDisplay = document.createElement('div');
        actionDisplay.className = 'ai-action-display';
        
        // Create progress indicator
        progressIndicator = document.createElement('div');
        progressIndicator.className = 'ai-progress-indicator';
        
        overlayContainer.appendChild(actionDisplay);
        overlayContainer.appendChild(progressIndicator);
        document.body.appendChild(overlayContainer);
    }

    // Show action overlay with details
    function showAction(actionData) {
        initOverlay();
        
        // Clear any existing timeout
        if (currentActionTimeout) {
            clearTimeout(currentActionTimeout);
        }

        // Update action display
        actionDisplay.innerHTML = `
            <div class="action-type">${actionData.type.toUpperCase()}</div>
            <div class="action-description">${actionData.description || 'Performing action...'}</div>
            ${actionData.selector ? `<div class="action-target">Target: ${actionData.selector}</div>` : ''}
            ${actionData.text ? `<div class="action-text">Text: ${actionData.text}</div>` : ''}
        `;

        // Show overlay with animation
        overlayContainer.classList.add('visible');
        actionDisplay.classList.add('active');

        // Add visual indicators based on action type
        if (actionData.type === 'click' && actionData.coordinates) {
            showClickIndicator(actionData.coordinates.x, actionData.coordinates.y);
        } else if (actionData.selector) {
            highlightTargetElement(actionData.selector);
        }

        // Auto-hide after 3 seconds
        currentActionTimeout = setTimeout(() => {
            hideAction();
        }, 3000);
    }

    // Show click indicator at specific coordinates
    function showClickIndicator(x, y) {
        const clickMarker = document.createElement('div');
        clickMarker.className = 'ai-click-marker';
        clickMarker.style.left = x + 'px';
        clickMarker.style.top = y + 'px';
        
        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'ai-click-ripple';
        clickMarker.appendChild(ripple);
        
        document.body.appendChild(clickMarker);
        
        // Remove after animation
        setTimeout(() => {
            clickMarker.remove();
        }, 1000);
    }

    // Highlight target element with outline
    function highlightTargetElement(selector) {
        try {
            const element = document.querySelector(selector);
            if (element) {
                const rect = element.getBoundingClientRect();
                
                const highlight = document.createElement('div');
                highlight.className = 'ai-element-highlight';
                highlight.style.position = 'fixed';
                highlight.style.left = rect.left + 'px';
                highlight.style.top = rect.top + 'px';
                highlight.style.width = rect.width + 'px';
                highlight.style.height = rect.height + 'px';
                highlight.style.pointerEvents = 'none';
                highlight.style.zIndex = '999999';
                
                document.body.appendChild(highlight);
                
                setTimeout(() => {
                    highlight.remove();
                }, 2000);
            }
        } catch (e) {
            console.error('Error highlighting element:', e);
        }
    }

    // Hide action overlay
    function hideAction() {
        if (actionDisplay) {
            actionDisplay.classList.remove('active');
        }
        if (overlayContainer) {
            overlayContainer.classList.remove('visible');
        }
    }

    // Update progress
    function updateProgress(percentage, status) {
        initOverlay();
        
        progressIndicator.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-status">${status || 'Processing...'}</div>
        `;
        
        if (percentage >= 100) {
            setTimeout(() => {
                cleanup();
            }, 2000);
        }
    }

    // Cleanup overlay
    function cleanup() {
        if (currentActionTimeout) {
            clearTimeout(currentActionTimeout);
        }
        
        if (overlayContainer) {
            overlayContainer.remove();
            overlayContainer = null;
            actionDisplay = null;
            progressIndicator = null;
        }
        
        // Remove any remaining indicators
        document.querySelectorAll('.ai-click-marker, .ai-element-highlight').forEach(el => el.remove());
    }

    // Listen for messages from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'SHOW_ACTION_OVERLAY') {
            showAction(event.data.action);
        } else if (event.data.type === 'UPDATE_PROGRESS') {
            updateProgress(event.data.percentage, event.data.status);
        } else if (event.data.type === 'CLEANUP_OVERLAY') {
            cleanup();
        }
    });

    // Also listen for direct chrome runtime messages
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'showOverlay') {
                showAction(request.actionData);
                sendResponse({ success: true });
            } else if (request.action === 'updateProgress') {
                updateProgress(request.percentage, request.status);
                sendResponse({ success: true });
            } else if (request.action === 'cleanupOverlay') {
                cleanup();
                sendResponse({ success: true });
            }
        });
    }

    // Auto-cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
})();