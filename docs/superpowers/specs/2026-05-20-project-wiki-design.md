# Project Wiki (Second Brain) Design

**Date:** 2026-05-20
**Status:** Proposed

## Summary

A persistent, LLM-maintained wiki for Project Capacitor that accumulates project knowledge over time. The wiki sits between raw source documents and Claude sessions, providing structured, interlinked context that compounds with every ingest and query.

## Goals

1. Break down the HTX take-home spec into queryable, interlinked wiki pages
2. Accumulate implementation decisions, gotchas, and findings as the project is built
3. Give future Claude sessions instant project context via `wiki/index.md`

## Directory Structure

```
raw/                                  # Immutable source documents
  └── Software Engineering Take Home Test v2.0.pdf

wiki/
  ├── index.md                        # Content catalog — Claude reads this first
  ├── log.md                          # Append-only chronological activity log
  ├── overview.md                     # Living synthesis of the whole project
  ├── entities/
  │   ├── developer.md                # Developer: properties, rules, seed data
  │   ├── task.md                     # Task: properties, statuses, business rules
  │   └── skill.md                    # Skill: properties, relationships
  ├── requirements/
  │   ├── part1-database.md           # DB schema requirements, seed data
  │   ├── part2-backend-api.md        # API operations, constraints
  │   ├── part3-frontend.md           # SPA pages, wireframe notes
  │   ├── part4-subtasks.md           # Nested subtask feature, status rules
  │   ├── part5-llm-skill-id.md       # LLM integration for skill identification
  │   └── part6-containerization.md   # Docker/docker-compose requirements
  ├── decisions/                      # ADRs (numbered: 001-title.md)
  └── notes/                          # Implementation findings, gotchas, research
```

## Schema (Wiki Operating Rules)

### Page Conventions

- All wiki pages use `[[wikilink]]` syntax for cross-references
- Entity pages describe properties, relationships, business rules, and seed data
- Requirement pages map 1:1 to spec parts — include acceptance criteria
- Decision pages use ADR format: context, decision, consequences
- Note pages are freeform — implementation findings, gotchas, research
- `log.md` entries prefixed with `## [YYYY-MM-DD] verb | subject` for parseability

### Workflows

**Ingest** — when a new source is added to `raw/`:
1. Read the source document
2. Write/update relevant wiki pages (entities, requirements, notes)
3. Update `wiki/index.md` with any new pages
4. Append an entry to `wiki/log.md`

**Query** — when asked a question about the project:
1. Read `wiki/index.md` to find relevant pages
2. Read those pages
3. Synthesize answer with `[[page]]` citations
4. If the answer is valuable, offer to file it as a new wiki page

**Lint** — periodic health check:
1. Scan for orphan pages (not in index), missing cross-links, stale content
2. Report findings, don't auto-fix

## Initial Content Plan

On first ingest of the PDF, the wiki is populated with:

- **overview.md** — Project summary: HTX take-home test, full-stack Task Assignment app, tech stack (TypeScript, React, Node.js, PostgreSQL, Docker), 7 parts
- **3 entity pages** — Extracted from Part 1: Developer (name, skills, task assignments, seed data), Task (title, required skills, status, assignee, subtask rules), Skill (Frontend/Backend, many-to-many relationship with developers)
- **6 requirement pages** — One per spec part, capturing operations, constraints, wireframe descriptions, and acceptance criteria
- **index.md** — Catalog of all pages with one-line summaries
- **log.md** — First entry recording the PDF ingest

## CLAUDE.md Integration

A `## Project Wiki` section will be added to CLAUDE.md containing:
- Wiki location and purpose
- Instructions to read `wiki/index.md` before answering project questions
- The three workflows (ingest, query, lint) as slash-command-style operations
- Page conventions (wikilinks, ADR format, log format)

## Trade-offs

- **Chose flat structure over heavy categorization** — this is a single take-home project, not a multi-month research effort. Four folders (entities, requirements, decisions, notes) is enough.
- **Chose index-based navigation over search tooling** — at the expected scale (~20-30 pages), the index file is sufficient. No need for embedding-based search.
- **Wiki is LLM-maintained** — the user reads it in Obsidian or the editor; Claude writes and maintains all pages.
