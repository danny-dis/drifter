# Drifter

> A tiny AI creature that lives in your browser tab — built entirely on [puter.js](https://developer.puter.com) (free tier, no API key needed).

Drifter is a tamagotchi that does research. It thinks, searches, writes, reflects — all on its own, continuously. No backend, no API keys, no server. Runs entirely in the browser using Puter's user-pays model (users cover their own AI usage via their Puter account).

## How it works

1. **Onboard** — Name your drifter, mash your keyboard to generate a personality genome (SHA-512 entropy).
2. **Watch** — It wanders a pixel-art room, picks moods, does web research, writes files, and remembers everything.
3. **Talk** — Send messages in the chat. Toggle focus mode to lock it onto a topic.
4. **Explore** — Its workspace files persist in localStorage. Reflection cycles extract insights over time.

## Architecture

Pure browser SPA — no build step, no npm, no backend.

```
drifter/
├── index.html          # SPA entry point
├── css/
│   └── style.css       # All styles (dark theme, pixel-art room, chat)
├── js/
│   ├── genome.js       # Personality genome (entropy → traits)
│   ├── memory.js       # Smallville-style memory stream (recency × importance × relevance)
│   ├── room.js         # Canvas-based pixel-art room renderer
│   ├── thinker.js      # Thinking loop + tools + workspace (localStorage)
│   └── app.js          # Orchestrator: onboarding, UI wiring
└── README.md
```

**AI calls go through `puter.ai.chat()`** — Puter's client-side SDK. Default model: `gpt-5.4-nano` (free). Tools include: `write_file`, `read_file`, `list_files`, `search_web`, `fetch_url`, `move`, `respond`.

## Quick start

```bash
# Clone
git clone https://github.com/danny-dis/drifter.git
cd drifter

# Serve statically (any static server works)
npx serve .
# or
python -m http.server 8000

# Open http://localhost:8000
```

That's it. No `npm install`, no `.env`, no API key.

## Commands

| Command | Effect |
|---------|--------|
| `/focus <topic>` | Lock drifter onto a specific topic |
| `/focus off` | Release focus mode |
| `/pause` | Pause the thinking loop |
| `/resume` | Resume the thinking loop |

## Storage

- **Persona + genome**: `localStorage['drifter_state']`
- **Memory stream**: `localStorage['drifter_memories_<name>']`
- **Workspace files**: `localStorage['drifter_workspace_<name>']`

Everything persists across page reloads. Crabs are independent — create multiple and switch between them.

## Customization

Change the model in `js/app.js`:
```js
this.model = "gpt-5.4-nano"; // any puter.js-supported model
```

Or use the config object passed to `Thinker`:
```js
thinker = new Thinker(genome, memory, room, {
  model: "deepseek/deepseek-v4-pro", // or any model from https://developer.puter.com/ai/models/
  onEvent: handleThinkerEvent
});
```

## Warnings

- **User-pays model**: AI calls use your Puter account's credits. Free tier models (`gpt-5.4-nano`) have generous limits.
- **localStorage only**: No cloud sync. Clear browser data = lost memories.
- **CORS**: `fetch_url` may be blocked on some sites. Puter's built-in `web_search` is more reliable for research.

## License

MIT
