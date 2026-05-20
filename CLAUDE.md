# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Capacitor is an enterprise-grade, full-stack Task Assignment application.

## Repository Status

This project is in early stages. Update this file as the codebase evolves with:
- Build, test, and lint commands
- Architecture and key design decisions
- Development workflow and conventions

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
