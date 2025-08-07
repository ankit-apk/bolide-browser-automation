# AI Web Automation Browser Extension - Powered by Gemini 2.5 Flash

An intelligent browser extension that automates web tasks using Google's latest **Gemini 2.5 Flash** model with advanced thinking capabilities. Simply describe what you want to do, and watch as the AI reasons through the task and performs actions automatically.

## 🚀 Now Updated with Gemini 2.5 Flash!

### What's New in Version 3.0:
- **Gemini 2.5 Flash Integration** - The latest model with thinking capabilities
- **Advanced Reasoning** - The AI now "thinks" before acting, leading to smarter decisions
- **1M Token Context Window** - Can process massive amounts of page content
- **Improved Performance** - 22% more efficient than previous versions
- **Better Understanding** - Enhanced multimodal capabilities for text, images, and page structure
- **Continuous Workflow** - Persistent side panel that stays open across navigations

## Features

- **Natural Language Task Description**: Simply type what you want to accomplish
- **Visual Screenshot Analysis**: Captures and analyzes pages using Gemini 2.5 Flash Vision
- **Smart Action Generation**: AI reasons through tasks and generates optimal action sequences
- **Continuous Workflow Mode**: Keeps working across page navigations until goal is achieved
- **Persistent Side Panel**: Stays open while you browse, showing real-time progress
- **Visual Feedback**: See exactly what the extension is doing with overlay indicators
- **Action Types Supported**:
  - Navigate to URLs
  - Click on elements
  - Type text into forms
  - Press Enter to submit
  - Select dropdown options
  - Scroll the page
  - Wait for elements to load
  - Complete multi-step workflows

## Installation

### Prerequisites
- Google Chrome or Chromium-based browser
- Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Steps

1. **Clone or download this repository** to your local machine

2. **Generate the extension icons**:
   - Open `create-icons.html` in your browser
   - Click each "Download" button to save the icon files
   - Place the downloaded PNG files in the extension directory

3. **Load the extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `ai-web-automation-extension` directory

4. **Configure your API key**:
   - Click the extension icon to open the side panel
   - Enter your Gemini API key
   - Click "Save"

## Usage

### Side Panel Mode (Recommended)

1. **Click the extension icon** - Opens the persistent side panel

2. **Enter your task** in natural language:
   - "Find me a hotel in Paris for next weekend"
   - "Search for the best laptop under $1000"
   - "Book a flight from New York to London"
   - "Find Italian restaurants near me with good reviews"

3. **Click "Start Task"** and watch the AI work:
   - See real-time progress in the activity log
   - Monitor workflow steps as they execute
   - View current page information
   - Stop anytime with the Stop button

### How It Works with Gemini 2.5 Flash

1. **Thinking Phase**: Gemini 2.5 Flash uses its thinking capabilities to:
   - Understand the complete task
   - Break it down into logical steps
   - Plan the optimal workflow

2. **Continuous Analysis**: After each action:
   - Captures the new page state
   - Asks "What should I do next?"
   - Reasons about progress toward the goal
   - Generates next actions or declares completion

3. **Smart Navigation**: Handles complex multi-page workflows:
   - Remembers the original goal
   - Tracks completed actions
   - Adapts to page changes
   - Continues until task is complete

## Example Workflows

### Finding a Hotel
```
Task: "Find me a good hotel in Paris"
1. AI navigates to Google
2. Searches for "hotels in Paris"
3. Clicks on hotel booking sites
4. Filters by ratings and price
5. Shows you the results
```

### Product Research
```
Task: "Find the best wireless headphones under $200"
1. Searches for wireless headphones
2. Navigates to shopping sites
3. Applies price filters
4. Checks reviews and ratings
5. Compares options
```

## Gemini 2.5 Flash Capabilities

- **Thinking Mode**: The model reasons through problems before acting
- **1M Token Context**: Can process entire web pages with all their content
- **Multimodal Understanding**: Analyzes text, images, and page structure
- **Knowledge Cutoff**: January 2025 - has the latest information
- **Enhanced Safety**: Built-in safety filters for responsible automation

## Configuration

Edit `config.js` to customize:
- Model parameters (temperature, max tokens)
- Action delays and timeouts
- Screenshot quality settings
- UI preferences
- Security restrictions
- Debug options

## Security & Privacy

- **API Key Storage**: Your Gemini API key is stored locally in Chrome's secure storage
- **Sensitive Sites Protection**: Blocks automation on banking and payment sites
- **Local Processing**: Screenshots processed locally before sending to API
- **No Data Collection**: Extension doesn't collect or store personal data
- **Safe Browsing**: Respects robots.txt and site policies

## Troubleshooting

### Extension doesn't load
- Ensure all files are in the same directory
- Check Developer mode is enabled
- Verify manifest.json is valid

### "Could not connect to page" error
- The extension now auto-injects scripts
- Works on most regular websites
- Cannot work on Chrome system pages

### AI generates wrong actions
- Gemini 2.5 Flash has improved accuracy
- The thinking mode reduces errors
- Try more specific task descriptions

### Task gets stuck
- Maximum 20 iterations to prevent loops
- Use Stop button to halt execution
- Check activity log for errors

## Limitations

- Works only on publicly accessible web pages
- Cannot interact with Chrome system pages
- Some sites with anti-automation may not work
- API rate limits apply based on your plan
- Maximum 20 iterations per task (configurable)

## Development

### File Structure
- `manifest.json` - Extension configuration
- `sidepanel.html/css/js` - Side panel interface
- `popup.html/css/js` - Legacy popup interface
- `background.js` - Service worker with Gemini 2.5 Flash integration
- `content.js` - Page interaction and screenshot capture
- `overlay.js/css` - Visual feedback system
- `config.js` - Configuration settings

### Key Improvements in v3.0
- Upgraded to Gemini 2.5 Flash API endpoint
- Enhanced prompts for thinking mode
- Increased token limits for better reasoning
- Continuous workflow with feedback loop
- Persistent side panel interface
- Better error handling and recovery

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is provided as-is for educational and personal use.

## Disclaimer

This extension is for automation of your own tasks only. Please:
- Respect website terms of service
- Don't use for web scraping without permission
- Avoid bypassing CAPTCHAs or security measures
- Don't use for automated purchasing (bots)
- Follow all applicable laws and regulations

## Version History

- **v3.0.0** - Gemini 2.5 Flash integration with thinking mode
- **v2.0.0** - Added side panel and continuous workflow
- **v1.0.0** - Initial release with Gemini 1.5 Flash