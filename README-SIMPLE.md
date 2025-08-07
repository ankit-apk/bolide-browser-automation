# AI Browser Control - Simple Implementation

## 🎯 What This Does

A clean, simple Chrome extension that gives AI control of your browser through real-time screen sharing and chat interface.

## ✨ Features

- **Real-time Screen Sharing**: Captures and sends screenshots to AI every second
- **Simple Chat Interface**: Talk to the AI naturally 
- **Full Browser Automation**: AI can click, type, scroll, and navigate
- **Visual Feedback**: See what the AI is doing with highlights and notifications
- **WebSocket Streaming**: Uses Gemini Live API for real-time interaction

## 🚀 Quick Start

### 1. Get API Key
- Go to https://makersuite.google.com/app/apikey
- Create a new API key
- Copy it

### 2. Install Extension
1. Open Chrome → Extensions (chrome://extensions/)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder
5. **IMPORTANT**: Rename `simple-manifest.json` to `manifest.json`

### 3. Use It
1. Click the extension icon to open side panel
2. Paste your Gemini API key
3. Click "Start Screen Share"
4. Type commands or questions in the chat

## 💬 Example Commands

- "Click the search button"
- "Fill in the form with my information"
- "Find coffee shops near me"
- "Scroll down to see more"
- "Navigate to amazon.com"
- "What's on this page?"
- "Help me book a flight"

## 🏗️ Architecture

```
simple-manifest.json   → Extension configuration
simple-background.js   → WebSocket & orchestration
simple-content.js      → Page interaction & screenshots  
simple-chat.html       → Chat interface
simple-chat.js         → UI controller
```

## 🔧 How It Works

1. **Screen Capture**: Takes screenshot every second using Canvas API
2. **AI Analysis**: Sends to Gemini 2.0 Flash via WebSocket
3. **Action Generation**: AI responds with specific actions
4. **Execution**: Content script executes actions on page
5. **Feedback**: Visual highlights show what's happening

## 🎨 Key Components

### Background Script
- Manages WebSocket connection to Gemini Live API
- Coordinates between chat UI and content scripts
- Handles screenshot streaming (1 per second)

### Content Script  
- Captures screenshots of visible page
- Executes AI-generated actions
- Provides visual feedback

### Chat Interface
- Simple, clean messaging UI
- Real-time status updates
- Easy API key management

## 📝 Technical Details

### WebSocket Endpoint
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent
```

### Model
- Gemini 2.0 Flash Experimental

### Action Format
```json
{
  "action": "click|type|scroll|navigate",
  "selector": "CSS selector or text",
  "value": "text or URL (if needed)",
  "description": "What this does"
}
```

## 🐛 Troubleshooting

### Extension Won't Load
- Make sure you renamed `simple-manifest.json` to `manifest.json`
- Check Developer mode is enabled

### Not Connecting
- Verify API key is correct
- Check internet connection
- Look for errors in extension console

### Actions Not Working
- Some sites block automation
- Try refreshing the page
- Check if elements are visible

## 🔒 Privacy

- Screenshots are only sent while streaming
- API key stored locally
- No data sent to third parties
- All processing via Google's Gemini API

## 🚦 Status Indicators

- 🟢 Green dot = Connected & streaming
- ⚫ Gray dot = Disconnected
- 👤 User message
- 🤖 AI response  
- ⚡ Action being performed
- ❌ Error occurred

## 💡 Tips

1. Be specific with commands
2. Wait for actions to complete
3. The AI can see everything visible on screen
4. Works best on standard web pages
5. Some sites may block automation

## 🎯 Use Cases

- Form filling assistance
- Web navigation help
- Content extraction
- Shopping assistance
- Research automation
- Accessibility support

---

**Built with Gemini 2.0 Flash Live API**