# Drifter

> A cross-platform AI desktop/mobile agent — your persistent AI companion.

## What is Drifter?

Drifter is an AI companion that lives on your desktop as a floating pet character. It captures your ideas, researches them in the background, connects related concepts, and builds a living knowledge graph of your interests. Think of it as a tamagotchi that does research.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.12+
- uv (Python package manager)
- An OpenAI API key (or Ollama for local models)

### Setup

```bash
cd /home/bee/projects/drifter

# Install dependencies
npm install
cd backend && uv sync && cd ..

# Set your API key
export DRIFTER_OPENAI_API_KEY="sk-..."
export DRIFTER_LLM_PROVIDER="openai"
export DRIFTER_LLM_MODEL="gpt-4o-mini"

# Start backend
cd backend && uv run python -m src.main --port 7842 &

# Start frontend dev server
cd frontend && npm run dev
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DRIFTER_LLM_PROVIDER` | Primary LLM provider | `openai` |
| `DRIFTER_LLM_MODEL` | Model name | `gpt-4o-mini` |
| `DRIFTER_OPENAI_API_KEY` | OpenAI API key | — |
| `DRIFTER_ANTHROPIC_API_KEY` | Anthropic API key | — |
| `DRIFTER_GROQ_API_KEY` | Groq API key | — |
| `DRIFTER_OLLAMA_BASE_URL` | Ollama base URL | `http://localhost:11434` |
| `DRIFTER_EMBEDDING_PROVIDER` | Embedding provider | `openai` |
| `DRIFTER_EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Pet Window  │  │ 2D Office    │  │ Quick Capture   │ │
│  │ (Electron)  │  │ (5 pages)    │  │ (slides from pet)│ │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                │                    │          │
│         └────────────────┼────────────────────┘          │
│                          │ HTTP + WebSocket              │
├──────────────────────────┼───────────────────────────────┤
│               Backend (Python FastAPI)                    │
│                          │ localhost:7842                │
│  ┌─────────────┐  ┌──────┴───────┐  ┌─────────────────┐ │
│  │ SQLite      │  │ SQLite       │  │ Sub-Agent Pool  │ │
│  │ (memory.db) │  │ (vectors)    │  │ (max 3 concurrent)│
│  └─────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
drifter/
├── package.json              # Root monorepo with npm workspaces
├── electron/                 # Electron desktop shell
│   ├── main.ts               # Main process (spawns backend, creates windows)
│   ├── preload.ts            # Secure context bridge
│   ├── pet-window.ts         # Floating pet window manager (reusable)
│   └── config.ts             # Cross-platform config management
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   │   ├── OfficeLayout.tsx    # Main app shell with navigation
│   │   │   ├── Onboarding.tsx      # First-launch flow
│   │   │   ├── PetWindow.tsx       # Floating pet renderer
│   │   │   └── CapturePanel.tsx    # Quick capture pill
│   │   ├── pages/            # 2D Office pages
│   │   │   ├── CapturePage.tsx     # Home: input + idea feed
│   │   │   ├── IdeaMapPage.tsx     # Concept graph visualization
│   │   │   ├── ProjectsPage.tsx    # Kanban board
│   │   │   ├── CompletedPage.tsx   # Finished work
│   │   │   └── MemoryPage.tsx      # Knowledge wiki + graph
│   │   ├── platform/         # Platform abstraction layer
│   │   │   └── index.ts            # Unified API for Electron/Capacitor/Web
│   │   ├── styles/           # Design system
│   │   │   └── globals.css         # CSS custom properties + Tailwind
│   │   └── assets/sprites/   # 6 animated SVG characters
│   └── ...
├── backend/                  # Python FastAPI server
│   ├── src/
│   │   ├── main.py           # Entry point
│   │   ├── server.py         # FastAPI app (20+ REST endpoints + WebSocket)
│   │   ├── database/
│   │   │   ├── models.py           # SQLite schema + async CRUD (12 tables)
│   │   │   └── vector_store.py     # SQLite-backed vector store
│   │   ├── agents/
│   │   │   ├── pool.py             # Sub-agent research pool
│   │   │   ├── idea_mapper.py      # Semantic clustering
│   │   │   └── chat.py             # Project-context chat + wiki summary
│   │   ├── router/
│   │   │   └── llm.py              # Multi-provider LLM router
│   │   └── utils/
│   │       ├── notifications.py    # Cooldown-managed notifications
│   │       └── reports.py          # Timed report generation
│   └── ...
└── capacitor.config.ts       # Mobile configuration (iOS/Android)
```

## API Reference

### REST Endpoints

```
POST   /api/ideas              # Create new idea
GET    /api/ideas              # List ideas (filters: status, tag, limit, offset)
GET    /api/ideas/{id}         # Get single idea
DELETE /api/ideas/{id}         # Delete idea

GET    /api/concepts           # List all concept nodes
GET    /api/concepts/{id}      # Get concept with linked ideas
POST   /api/concepts/{id}/project  # Promote to project
POST   /api/concepts/{id}/dismiss  # Dismiss concept
POST   /api/concepts/{id}/research  # Trigger research

GET    /api/projects           # List projects
GET    /api/projects/{id}      # Get project detail
PUT    /api/projects/{id}      # Update project
POST   /api/projects/{id}/ask  # Ask Drifter about project

GET    /api/projects/completed # List completed projects

GET    /api/wiki               # List wiki entries
GET    /api/wiki/{id}          # Get wiki entry
PUT    /api/wiki/{id}          # Edit wiki entry
GET    /api/wiki/summary       # "What do you know about me?"

POST   /api/reports            # Create timed report
GET    /api/reports/{id}       # Get report
GET    /api/reports/{id}/content  # Get report content

GET    /api/config             # Get user config
PUT    /api/config             # Update config
GET    /api/config/companion   # Get companion config
PUT    /api/config/companion   # Update companion config

GET    /health                 # Health check
```

### WebSocket Events

```
idea_captured       → { id, raw, timestamp }
idea_processed      → { id, tags }
concept_mapped      → { concept_id, name, idea_count }
research_update     → { concept_id, status, progress }
tangibility_threshold → { concept_id, name, score, message }
timer_complete      → { report_id, topic }
pet_animation       → { state: 'thinking' | 'has_news' | 'timer_done' | 'idea_connected' }
```

## Design System

- **Calm, low-saturation palette** — soft blues and greens, no aggressive reds/oranges
- **15px minimum body text**, line-height 1.6
- **Respects `prefers-reduced-motion`** — all animations disabled when active
- **No notification badges with numbers** — pet animation state signals readiness
- **No confirmation dialogs** — 5-second undo toast instead

## LLM Providers

Drifter supports multiple LLM providers with role-based routing:

| Role | Purpose | Recommended Model |
|---|---|---|
| `quick_capture` | Tag generation, concept naming | gpt-4o-mini, claude-haiku |
| `research` | Web search, concept research | gpt-4o, claude-sonnet |
| `report_generation` | Report compilation | gpt-4o, claude-sonnet |
| `memory_maintenance` | Wiki summary, knowledge graph | gpt-4o-mini |
| `embedding` | Vector embeddings | text-embedding-3-small |

**Fallback**: If primary provider fails, automatically falls back to Ollama (local).

## License

MIT
