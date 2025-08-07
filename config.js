// Configuration for AI Web Automation Extension

const CONFIG = {
    // Gemini 2.5 Flash API Settings - Updated January 2025
    gemini: {
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        model: 'gemini-2.5-flash',
        temperature: 0.2,
        maxOutputTokens: 8192,  // Increased for better reasoning (max: 65,536)
        defaultTimeout: 45000,  // 45 seconds - increased for thinking mode
        // Gemini 2.5 Flash features
        features: {
            thinking: true,  // Thinking mode enabled by default
            structuredOutput: true,
            caching: true,
            functionCalling: true,
            codeExecution: true,
            searchGrounding: true
        },
        contextWindow: 1048576,  // 1M tokens input limit
        knowledgeCutoff: 'January 2025'
    },

    // Action Execution Settings
    actions: {
        defaultDelay: 1000, // Default delay between actions (ms)
        clickDelay: 500,
        typeDelay: 50, // Delay between keystrokes (ms)
        scrollDuration: 500,
        waitTimeout: 5000,
        highlightDuration: 1000,
        maxRetries: 3
    },

    // Screenshot Settings
    screenshot: {
        quality: 0.8,
        format: 'jpeg',
        maxWidth: 1920,
        maxHeight: 1080,
        captureMethod: 'html2canvas' // 'html2canvas' or 'dom'
    },

    // UI Settings
    ui: {
        overlayPosition: 'top-right',
        overlayAnimationDuration: 300,
        progressUpdateInterval: 100,
        maxHistoryItems: 10,
        showActionOverlay: true,
        showProgressBar: true
    },

    // Security Settings
    security: {
        allowedDomains: [], // Empty array allows all domains
        blockedDomains: [
            'bank',
            'paypal',
            'stripe',
            'checkout'
        ], // Domains containing these strings will be blocked
        sensitiveSelectors: [
            'input[type="password"]',
            'input[name*="cvv"]',
            'input[name*="card"]',
            'input[name*="ssn"]'
        ]
    },

    // Debug Settings
    debug: {
        enabled: false,
        logLevel: 'info', // 'error', 'warn', 'info', 'debug'
        logActions: true,
        logApiCalls: true,
        showDetailedErrors: false
    },

    // Task Templates (Predefined tasks)
    templates: [
        {
            name: 'Flight Search',
            description: 'Search for flights',
            template: 'Search for flights from {origin} to {destination} on {date}'
        },
        {
            name: 'Form Fill',
            description: 'Fill out a form',
            template: 'Fill out the form with: Name: {name}, Email: {email}'
        },
        {
            name: 'Product Search',
            description: 'Search for products',
            template: 'Find {product} with price under {maxPrice}'
        }
    ],

    // Performance Settings
    performance: {
        maxConcurrentActions: 1,
        batchSize: 5,
        cacheScreenshots: true,
        cacheTimeout: 60000 // 1 minute
    },

    // Storage Keys
    storage: {
        apiKeyKey: 'geminiApiKey',
        historyKey: 'taskHistory',
        settingsKey: 'userSettings',
        cacheKey: 'screenshotCache'
    }
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}