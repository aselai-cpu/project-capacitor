# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Capacitor is an enterprise-grade, full-stack Task Assignment application.

## Commands

```bash
# Backend
cd backend && npm run dev          # Start dev server (port 5000)
cd backend && npm run build        # TypeScript compile
cd backend && npm test             # Run unit tests (64 tests)
cd backend && npm run test:coverage # Tests with coverage report

# Frontend
cd frontend && npm run dev         # Start dev server (port 5173)
cd frontend && npm run build       # TypeScript + Vite build
cd frontend && npm test            # Run unit tests (39 tests)

# E2E tests (requires backend + frontend running)
npx playwright test                # 8 E2E tests

# Docker (full stack)
docker-compose up --build          # Start all services
```

## LLM Configuration

The app supports 4 LLM providers via Vercel AI SDK — auto-detected from API key in `.env`:

| Env var | Provider | Default model |
|---------|----------|---------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini | gemini-2.5-flash |
| `OPENAI_API_KEY` | OpenAI | gpt-4o-mini |
| `ANTHROPIC_API_KEY` | Anthropic | claude-haiku-4-5-20251001 |
| `MOONSHOT_API_KEY` | Moonshot Kimi | kimi-k2.5 |

Set ONE key — auto-detected. Override with `LLM_PROVIDER` and `LLM_MODEL` env vars. No key = fail-open (tasks created without skills).

## Git Workflow

- Make frequent, incremental commits — commit after each meaningful unit of work (e.g., adding a function, fixing a bug, updating config), not in large batches
- Write detailed commit messages: first line is a concise summary (≤72 chars), followed by a blank line and a body explaining *what* changed and *why*
- Prefer many small commits over few large ones — this makes review, bisect, and revert easier

## Documentation

Keep documentation in `docs/` using the Diataxis framework — four distinct types, never blended:

```
docs/
├── tutorials/          # Guided learning experiences ("help me learn")
├── how-to/             # Steps to accomplish a specific goal ("help me do X")
├── reference/           # Factual technical descriptions ("give me the facts")
└── concepts/            # Context, reasoning, and design decisions ("help me understand why")
```

- Update relevant docs when adding features or changing behavior
- Each doc must be clearly one type — don't mix tutorials with reference, or how-to guides with explanation
- Use `/diataxis-documentation` skill when writing or reviewing docs

## Project Wiki

LLM-maintained knowledge base at `wiki/`. Source documents live in `raw/` (immutable — never modify).

**Before answering any project question**, read `wiki/index.md` to find relevant pages, then read those pages.

### Ground Rules

1. Never modify files in `raw/`
2. Always read `wiki/index.md` first when answering project questions
3. Every new page must be added to `wiki/index.md`
4. Every action must be logged in `wiki/log.md`
5. Prefer updating existing pages over creating new ones

### Page Conventions

- YAML frontmatter on all pages: `type`, `title`, `created`, `updated`
- Cross-references use `[[wikilink]]` syntax
- Index entries: `- [[wiki/category/filename]] -- one-line description`
- Log entries: `## [YYYY-MM-DD] verb | subject` — verbs: `init` | `ingest` | `decision` | `query` | `lint` | `update`

### Workflows

- **`ingest [source]`** — read source from `raw/`, write/update wiki pages, update index, update overview if material, append to log
- **`query [question]`** — read index → read relevant pages → synthesize answer with `[[page]]` citations → offer to file valuable answers as new pages
- **`record decision: [title]`** — write ADR to `wiki/decisions/NNN-kebab-title.md`, cross-link, update index, log it
- **`lint wiki`** — scan for orphan pages, missing cross-links, stale content; report without auto-fixing
