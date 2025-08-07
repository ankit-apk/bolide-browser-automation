# WebSocket Workflow - Real-time Web Automation

## Overview
The WebSocket workflow is a new execution mode that provides real-time, step-by-step web automation with continuous screenshot streaming to the Gemini API.

## Key Features

### 🔄 Real-time Execution
- Maintains persistent WebSocket connection with Gemini
- Executes one action at a time
- Waits for feedback before proceeding to next action

### 📸 Continuous Screenshot Streaming
- Automatically captures and sends screenshots every 1 second
- Provides AI with real-time visual feedback
- Enables dynamic adjustment of actions based on current screen state

### 🚨 Smart Stuck Detection
- Detects when screen hasn't changed for 5+ seconds
- Automatically alerts AI to try alternative approaches
- Handles popups and unexpected UI elements

### ⚡ Dynamic Action Adjustment
- AI can modify its approach based on real-time feedback
- Handles page navigation and loading states
- Adapts to dynamic content and AJAX updates

## How It Works

1. **Connection Phase**
   - Establishes WebSocket connection to Gemini API
   - Sends initial setup with system instructions
   - Configures AI for step-by-step execution

2. **Task Initialization**
   - User provides task description
   - Initial screenshot captured and sent
   - AI analyzes and provides first action

3. **Execution Loop**
   - Execute single action
   - Capture screenshot every second
   - Send updates to AI
   - Receive next action
   - Repeat until complete

4. **Completion**
   - AI determines when task is complete
   - Stops screenshot streaming
   - Closes WebSocket connection

## Usage

1. Open the extension side panel
2. Click "🔄 WebSocket Mode" button
3. Enter your task description
4. Click "🔄 Real-time Mode" button
5. Watch as the AI executes actions with real-time feedback

## Benefits vs Traditional Mode

| Traditional Mode | WebSocket Mode |
|-----------------|----------------|
| Batch execution of multiple actions | One action at a time |
| Fixed action sequence | Dynamic adjustment based on feedback |
| No real-time feedback | Continuous screenshot streaming |
| Can get stuck on unexpected UI | Smart stuck detection and recovery |
| Less reliable on dynamic sites | Handles AJAX and dynamic content |

## Technical Details

- **WebSocket Endpoint**: `wss://generativelanguage.googleapis.com/v1beta/ws/`
- **Model**: Gemini 2.5 Flash
- **Screenshot Interval**: 1000ms (1 second)
- **Max Stuck Attempts**: 5 seconds before requesting alternative approach
- **Image Quality**: 0.8 JPEG compression
- **Max Image Size**: 1280x720 pixels

## Example Tasks

Perfect for:
- Complex multi-step workflows
- Sites with dynamic content
- Tasks requiring visual verification
- Handling popups and modals
- Form filling with validation
- Shopping and checkout flows
- Search and navigation tasks

## Error Handling

The WebSocket workflow includes robust error handling:
- Automatic reconnection on disconnect
- Screenshot capture fallbacks
- Action execution error recovery
- Alternative selector strategies
- Graceful degradation

## API Response Format

The AI responds with structured JSON:
```json
{
    "status": "in_progress|completed|stuck|error",
    "current_analysis": "Description of what AI sees",
    "next_action": {
        "type": "click|type|scroll|wait|navigate",
        "selector": "CSS selector",
        "value": "text or URL",
        "description": "Action description"
    },
    "reason": "Why this action is needed",
    "progress": "Percentage complete",
    "stuck_reason": "If stuck, explanation"
}
```

This new workflow represents a significant advancement in web automation reliability and adaptability.