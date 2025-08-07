// Side panel script for persistent AI assistant
let currentTask = null;
let isTaskRunning = false;
let workflowSteps = [];
let currentStepIndex = 0;
let apiKey = null;

document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const taskInput = document.getElementById('taskInput');
    const startTaskBtn = document.getElementById('startTask');
    const stopTaskBtn = document.getElementById('stopTask');
    const clearLogBtn = document.getElementById('clearLog');
    const statusBadge = document.getElementById('statusBadge');
    const workflowStepsDiv = document.getElementById('workflowSteps');
    const activityLog = document.getElementById('activityLog');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const currentUrl = document.getElementById('currentUrl');
    const currentTitle = document.getElementById('currentTitle');
    
    // Mode elements
    const taskModeBtn = document.getElementById('taskModeBtn');
    const workflowModeBtn = document.getElementById('workflowModeBtn');
    const liveModeBtn = document.getElementById('liveModeBtn');
    const taskSection = document.getElementById('taskSection');
    const liveSection = document.getElementById('liveSection');
    const startContinuousBtn = document.getElementById('startContinuous');
    const startWebSocketBtn = document.getElementById('startWebSocket');
    const startLiveBtn = document.getElementById('startLive');
    const stopLiveBtn = document.getElementById('stopLive');
    const liveIndicator = document.querySelector('.live-indicator');
    const liveStatusText = document.getElementById('liveStatusText');
    const liveMessageInput = document.getElementById('liveMessageInput');
    const sendLiveMessageBtn = document.getElementById('sendLiveMessage');
    
    let currentMode = 'task'; // 'task', 'workflow', 'live'
    let isLiveStreaming = false;

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            apiKey = result.geminiApiKey;
            addLog('API key loaded', 'success');
        }
    });

    // Update current page info
    updatePageInfo();

    // Save API key
    saveApiKeyBtn.addEventListener('click', function() {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;
            chrome.storage.local.set({ geminiApiKey: key }, function() {
                addLog('API key saved', 'success');
            });
        }
    });

    // Mode switching
    taskModeBtn.addEventListener('click', function() {
        currentMode = 'task';
        updateModeUI();
    });
    
    workflowModeBtn.addEventListener('click', function() {
        currentMode = 'workflow';
        updateModeUI();
    });
    
    liveModeBtn.addEventListener('click', function() {
        currentMode = 'live';
        updateModeUI();
    });
    
    function updateModeUI() {
        // Update button states
        taskModeBtn.classList.toggle('active', currentMode === 'task');
        workflowModeBtn.classList.toggle('active', currentMode === 'workflow');
        liveModeBtn.classList.toggle('active', currentMode === 'live');
        
        // Show/hide sections
        taskSection.style.display = currentMode === 'live' ? 'none' : 'block';
        liveSection.style.display = currentMode === 'live' ? 'block' : 'none';
        
        // Show/hide mode-specific buttons
        startTaskBtn.style.display = currentMode === 'task' ? 'inline-flex' : 'none';
        startContinuousBtn.style.display = currentMode === 'task' ? 'inline-flex' : 'none';
        startWebSocketBtn.style.display = currentMode === 'workflow' ? 'inline-flex' : 'none';
        
        if (currentMode === 'workflow') {
            addLog('WebSocket Mode: Real-time streaming with 1-second screenshots', 'info');
        }
    }

    // Start task (basic mode)
    startTaskBtn.addEventListener('click', async function() {
        const task = taskInput.value.trim();
        
        if (!apiKey) {
            addLog('Please enter your Gemini API key first', 'error');
            return;
        }

        if (!task) {
            addLog('Please describe what you want to do', 'error');
            return;
        }

        currentTask = task;
        isTaskRunning = true;
        workflowSteps = [];
        currentStepIndex = 0;

        startTaskBtn.disabled = true;
        stopTaskBtn.disabled = false;
        statusBadge.textContent = 'Running';
        statusBadge.classList.add('active');

        addLog(`Starting task: ${task}`, 'info');
        progressText.textContent = 'Initializing...';
        progressFill.style.width = '10%';

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to background to start basic task
        chrome.runtime.sendMessage({
            action: 'startTask',
            task: task,
            tabId: tab.id,
            apiKey: apiKey
        });
    });
    
    // Start continuous workflow
    startContinuousBtn.addEventListener('click', async function() {
        const task = taskInput.value.trim();
        
        if (!apiKey) {
            addLog('Please enter your Gemini API key first', 'error');
            return;
        }

        if (!task) {
            addLog('Please describe what you want to do', 'error');
            return;
        }

        currentTask = task;
        isTaskRunning = true;
        workflowSteps = [];
        currentStepIndex = 0;

        startContinuousBtn.disabled = true;
        stopTaskBtn.disabled = false;
        statusBadge.textContent = 'Running';
        statusBadge.classList.add('active');

        addLog(`Starting continuous workflow: ${task}`, 'info');
        progressText.textContent = 'Initializing continuous mode...';
        progressFill.style.width = '10%';

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to background to start continuous workflow
        chrome.runtime.sendMessage({
            action: 'startContinuousWorkflow',
            task: task,
            tabId: tab.id,
            apiKey: apiKey
        });
    });
    
    // Start WebSocket workflow
    startWebSocketBtn.addEventListener('click', async function() {
        const task = taskInput.value.trim();
        
        if (!apiKey) {
            addLog('Please enter your Gemini API key first', 'error');
            return;
        }

        if (!task) {
            addLog('Please describe what you want to do', 'error');
            return;
        }

        currentTask = task;
        isTaskRunning = true;
        workflowSteps = [];
        currentStepIndex = 0;

        startWebSocketBtn.disabled = true;
        stopTaskBtn.disabled = false;
        statusBadge.textContent = 'Streaming';
        statusBadge.classList.add('active');

        addLog(`Starting WebSocket workflow: ${task}`, 'info');
        addLog('📸 Screenshots will be sent every 1 second', 'info');
        progressText.textContent = 'Connecting to WebSocket...';
        progressFill.style.width = '10%';

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to background to start WebSocket workflow
        chrome.runtime.sendMessage({
            action: 'startWebSocketWorkflow',
            task: task,
            tabId: tab.id,
            apiKey: apiKey
        });
    });
    
    // Start multi-tab workflow
    startMultiTabBtn.addEventListener('click', async function() {
        const task = taskInput.value.trim();
        
        if (!apiKey) {
            addLog('Please enter your Gemini API key first', 'error');
            return;
        }

        if (!task) {
            addLog('Please describe what you want to do', 'error');
            return;
        }

        currentTask = task;
        isTaskRunning = true;
        workflowSteps = [];
        currentStepIndex = 0;

        startMultiTabBtn.disabled = true;
        stopTaskBtn.disabled = false;
        statusBadge.textContent = 'Multi-Tab';
        statusBadge.classList.add('active');

        addLog(`Starting multi-tab workflow: ${task}`, 'info');
        addLog('🌐 Opening and coordinating multiple tabs...', 'info');
        progressText.textContent = 'Analyzing task requirements...';
        progressFill.style.width = '10%';

        // Send message to background to start multi-tab workflow
        chrome.runtime.sendMessage({
            action: 'startMultiTabWorkflow',
            task: task,
            apiKey: apiKey
        });
    });

    // Stop task
    stopTaskBtn.addEventListener('click', function() {
        stopTask();
        chrome.runtime.sendMessage({ action: 'stopWorkflow' });
    });

    // Clear log
    clearLogBtn.addEventListener('click', function() {
        activityLog.innerHTML = '';
    });
    
    // Live mode controls
    startLiveBtn.addEventListener('click', async function() {
        if (!apiKey) {
            addLog('Please enter your Gemini API key first', 'error');
            return;
        }
        
        isLiveStreaming = true;
        startLiveBtn.disabled = true;
        stopLiveBtn.disabled = false;
        liveMessageInput.disabled = false;
        sendLiveMessageBtn.disabled = false;
        
        liveIndicator.textContent = '🔴';
        liveIndicator.classList.add('streaming');
        liveStatusText.textContent = 'Connecting...';
        statusBadge.textContent = 'Live';
        statusBadge.classList.add('active');
        
        addLog('🔴 Starting live mode...', 'info');
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Start live streaming
        chrome.runtime.sendMessage({
            action: 'startLiveMode',
            tabId: tab.id,
            apiKey: apiKey
        });
    });
    
    stopLiveBtn.addEventListener('click', function() {
        stopLiveMode();
    });
    
    // Send live message
    sendLiveMessageBtn.addEventListener('click', function() {
        const message = liveMessageInput.value.trim();
        if (message && isLiveStreaming) {
            chrome.runtime.sendMessage({
                action: 'sendLiveMessage',
                message: message
            });
            liveMessageInput.value = '';
        }
    });
    
    liveMessageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendLiveMessageBtn.click();
        }
    });
    
    function stopLiveMode() {
        isLiveStreaming = false;
        startLiveBtn.disabled = false;
        stopLiveBtn.disabled = true;
        liveMessageInput.disabled = true;
        sendLiveMessageBtn.disabled = true;
        
        liveIndicator.textContent = '⚫';
        liveIndicator.classList.remove('streaming');
        liveStatusText.textContent = 'Not streaming';
        statusBadge.textContent = 'Ready';
        statusBadge.classList.remove('active');
        
        addLog('Live mode stopped', 'info');
        
        chrome.runtime.sendMessage({ action: 'stopLiveMode' });
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'workflowUpdate') {
            handleWorkflowUpdate(request);
        } else if (request.action === 'pageChanged') {
            updatePageInfo();
            addLog(`Navigated to: ${request.url}`, 'info');
        } else if (request.action === 'stepCompleted') {
            markStepCompleted(request.stepIndex);
        } else if (request.action === 'workflowCompleted') {
            completeWorkflow(request.success, request.message);
        } else if (request.action === 'error') {
            addLog(`Error: ${request.message}`, 'error');
        }
    });

    function handleWorkflowUpdate(data) {
        // Handle WebSocket workflow-specific updates
        if (data.type) {
            switch(data.type) {
                case 'ready':
                    addLog('✓ WebSocket connected: ' + data.data, 'success');
                    break;
                case 'analysis':
                    addLog('🔍 Analysis: ' + data.data, 'info');
                    break;
                case 'action':
                    addLog('⚡ Action: ' + data.data, 'info');
                    break;
                case 'progress':
                    if (data.data) {
                        progressText.textContent = 'Progress: ' + data.data;
                    }
                    break;
                case 'completed':
                    addLog('✅ Task completed: ' + data.data, 'success');
                    completeWorkflow(true, data.data);
                    break;
                case 'stuck':
                    addLog('⚠️ Stuck: ' + data.data, 'warning');
                    break;
                case 'error':
                    addLog('❌ Error: ' + data.data, 'error');
                    break;
                case 'need_help':
                    addLog('🆘 ' + data.data, 'error');
                    break;
                case 'stopped':
                    addLog('⏹️ ' + data.data, 'info');
                    break;
                case 'message':
                    addLog('💬 ' + data.data, 'info');
                    break;
            }
        }
        
        // Handle regular workflow updates
        if (data.steps) {
            workflowSteps = data.steps;
            renderWorkflowSteps();
        }
        
        if (data.currentStep !== undefined) {
            currentStepIndex = data.currentStep;
            updateCurrentStep();
        }
        
        if (data.progress !== undefined) {
            progressFill.style.width = data.progress + '%';
        }
        
        if (data.status) {
            progressText.textContent = data.status;
        }
        
        if (data.log) {
            addLog(data.log, data.logType || 'info');
        }
    }

    function renderWorkflowSteps() {
        if (workflowSteps.length === 0) {
            workflowStepsDiv.innerHTML = '<div class="empty-state">No workflow steps yet</div>';
            return;
        }

        workflowStepsDiv.innerHTML = workflowSteps.map((step, index) => {
            let status = 'pending';
            let icon = '○';
            
            if (index < currentStepIndex) {
                status = 'completed';
                icon = '✓';
            } else if (index === currentStepIndex) {
                status = 'active';
                icon = '▶';
            }
            
            return `
                <div class="workflow-step ${status}" data-index="${index}">
                    <span class="step-icon ${status}">${icon}</span>
                    <span>${step.description || step.type}</span>
                </div>
            `;
        }).join('');
    }

    function updateCurrentStep() {
        const steps = workflowStepsDiv.querySelectorAll('.workflow-step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed', 'pending');
            const icon = step.querySelector('.step-icon');
            
            if (index < currentStepIndex) {
                step.classList.add('completed');
                icon.textContent = '✓';
                icon.classList.add('completed');
            } else if (index === currentStepIndex) {
                step.classList.add('active');
                icon.textContent = '▶';
                icon.classList.add('active');
            } else {
                step.classList.add('pending');
                icon.textContent = '○';
            }
        });
    }

    function markStepCompleted(stepIndex) {
        if (stepIndex < workflowSteps.length) {
            const step = workflowSteps[stepIndex];
            addLog(`✓ Completed: ${step.description || step.type}`, 'success');
        }
        currentStepIndex = stepIndex + 1;
        updateCurrentStep();
        
        const progress = Math.round((currentStepIndex / workflowSteps.length) * 100);
        progressFill.style.width = progress + '%';
    }

    function completeWorkflow(success, message) {
        isTaskRunning = false;
        startTaskBtn.disabled = false;
        stopTaskBtn.disabled = true;
        statusBadge.textContent = success ? 'Completed' : 'Failed';
        statusBadge.classList.remove('active');
        
        if (success) {
            addLog(`✅ Task completed: ${message || currentTask}`, 'success');
            progressFill.style.width = '100%';
            progressText.textContent = 'Task completed successfully!';
        } else {
            addLog(`❌ Task failed: ${message}`, 'error');
            progressText.textContent = 'Task failed';
        }
        
        // Reset after 3 seconds
        setTimeout(() => {
            if (!isTaskRunning) {
                statusBadge.textContent = 'Ready';
                progressFill.style.width = '0%';
                progressText.textContent = 'Ready to start';
            }
        }, 3000);
    }

    function stopTask() {
        isTaskRunning = false;
        startTaskBtn.disabled = false;
        startContinuousBtn.disabled = false;
        startWebSocketBtn.disabled = false;
        startMultiTabBtn.disabled = false;
        stopTaskBtn.disabled = true;
        statusBadge.textContent = 'Stopped';
        statusBadge.classList.remove('active');
        progressText.textContent = 'Task stopped';
        progressFill.style.width = '0%';
        addLog('Task stopped by user', 'info');
    }

    function addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="timestamp">${timestamp}</span>${message}`;
        activityLog.appendChild(entry);
        activityLog.scrollTop = activityLog.scrollHeight;
    }

    async function updatePageInfo() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            currentUrl.textContent = tab.url || '-';
            currentTitle.textContent = tab.title || '-';
        }
    }

    // Listen for tab changes
    chrome.tabs.onActivated.addListener(updatePageInfo);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'complete') {
            updatePageInfo();
        }
    });
});