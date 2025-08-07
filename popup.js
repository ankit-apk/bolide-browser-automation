document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const taskInput = document.getElementById('taskInput');
    const startTaskBtn = document.getElementById('startTask');
    const stopTaskBtn = document.getElementById('stopTask');
    const statusDiv = document.getElementById('status');
    const currentActionDiv = document.getElementById('currentAction');
    const progressFill = document.getElementById('progressFill');
    const taskHistoryList = document.getElementById('taskHistory');

    let isTaskRunning = false;

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            statusDiv.textContent = 'API key loaded';
            statusDiv.className = 'status-message success';
        }
    });

    // Load task history
    loadTaskHistory();

    // Save API key
    saveApiKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
                statusDiv.textContent = 'API key saved successfully';
                statusDiv.className = 'status-message success';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            });
        } else {
            statusDiv.textContent = 'Please enter a valid API key';
            statusDiv.className = 'status-message error';
        }
    });

    // Start task
    startTaskBtn.addEventListener('click', async function() {
        const task = taskInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            statusDiv.textContent = 'Please enter your Gemini API key first';
            statusDiv.className = 'status-message error';
            return;
        }

        if (!task) {
            statusDiv.textContent = 'Please describe what you want to do';
            statusDiv.className = 'status-message error';
            return;
        }

        isTaskRunning = true;
        startTaskBtn.disabled = true;
        stopTaskBtn.disabled = false;
        statusDiv.textContent = 'Starting task...';
        statusDiv.className = 'status-message';
        progressFill.style.width = '10%';

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if it's a restricted URL
            const restrictedUrls = [
                'chrome://',
                'chrome-extension://',
                'edge://',
                'about:',
                'file:///',
                'view-source:',
                'data:',
                'devtools://'
            ];
            
            const isRestricted = restrictedUrls.some(url => tab.url.startsWith(url));
            
            if (isRestricted || !tab.url || tab.url === 'about:blank') {
                statusDiv.textContent = 'Cannot run on this page. Please navigate to a regular website.';
                statusDiv.className = 'status-message error';
                resetUI();
                return;
            }
            
            // Send message to background script to start task
            chrome.runtime.sendMessage({
                action: 'startTask',
                task: task,
                tabId: tab.id,
                apiKey: apiKey
            }, function(response) {
                if (response && response.success) {
                    statusDiv.textContent = 'Task initiated successfully';
                    statusDiv.className = 'status-message success';
                } else {
                    statusDiv.textContent = response?.error || 'Failed to start task';
                    statusDiv.className = 'status-message error';
                    resetUI();
                }
            });

            // Save to history
            saveTaskToHistory(task);

        } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
            statusDiv.className = 'status-message error';
            resetUI();
        }
    });

    // Stop task
    stopTaskBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'stopTask' }, function(response) {
            statusDiv.textContent = 'Task stopped';
            statusDiv.className = 'status-message';
            resetUI();
        });
    });

    // Listen for status updates from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'statusUpdate') {
            statusDiv.textContent = request.status;
            statusDiv.className = 'status-message ' + (request.type || '');
            
            if (request.currentAction) {
                currentActionDiv.textContent = 'Current: ' + request.currentAction;
            }
            
            if (request.progress !== undefined) {
                progressFill.style.width = request.progress + '%';
            }
            
            if (request.completed) {
                resetUI();
                if (request.success) {
                    statusDiv.textContent = 'Task completed successfully!';
                    statusDiv.className = 'status-message success';
                } else {
                    statusDiv.textContent = 'Task failed: ' + (request.error || 'Unknown error');
                    statusDiv.className = 'status-message error';
                }
            }
        }
    });

    function resetUI() {
        isTaskRunning = false;
        startTaskBtn.disabled = false;
        stopTaskBtn.disabled = true;
        progressFill.style.width = '0%';
        currentActionDiv.textContent = '';
    }

    function saveTaskToHistory(task) {
        chrome.storage.local.get(['taskHistory'], function(result) {
            const history = result.taskHistory || [];
            const newTask = {
                task: task,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            history.unshift(newTask);
            if (history.length > 10) {
                history.pop();
            }
            
            chrome.storage.local.set({ taskHistory: history }, function() {
                loadTaskHistory();
            });
        });
    }

    function loadTaskHistory() {
        chrome.storage.local.get(['taskHistory'], function(result) {
            const history = result.taskHistory || [];
            taskHistoryList.innerHTML = '';
            
            history.forEach(item => {
                const li = document.createElement('li');
                li.className = item.status === 'success' ? 'success' : (item.status === 'failed' ? 'failed' : '');
                
                const taskText = document.createElement('span');
                taskText.textContent = item.task.substring(0, 40) + (item.task.length > 40 ? '...' : '');
                
                const timeText = document.createElement('span');
                timeText.className = 'task-time';
                const date = new Date(item.timestamp);
                timeText.textContent = date.toLocaleTimeString();
                
                li.appendChild(taskText);
                li.appendChild(timeText);
                taskHistoryList.appendChild(li);
            });
        });
    }
});