# Contributing to AI Web Automation Extension

Thanks for your interest in contributing!

- Use Node 18+.
- Run `npm run format:check` before committing; prefer `npm run format` to fix formatting.
- Keep functions small, with meaningful names and early returns.
- Avoid adding new controllers unless necessary; prefer improving existing abstractions.
- Avoid adding libraries to content scripts unless essential (MV3 limits).
- Don’t commit API keys or secrets.

## Code structure
- `background*.js`: orchestrates tasks, connects to Gemini.
- `*engine*.js`: reasoning/event loops.
- `*controller*.js`, `content*.js`: DOM/coordinate execution layers.
- `overlay.*`: user feedback UI.
- `config.js`: central settings.

## Pull Requests
- Describe the user story and why the change is needed.
- Include testing notes with a simple repro plan.
- Keep edits focused; avoid drive-by refactors.
