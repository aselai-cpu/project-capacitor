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
raw/                                  # Immutable source documents (moved here during setup)
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

## Ground Rules

1. **Never modify files in `raw/`** — sources are immutable
2. **Always read `wiki/index.md` first** when answering project questions
3. **Every new page must be added to `wiki/index.md`**
4. **Every action must be logged in `wiki/log.md`**
5. **Prefer updating existing pages over creating new ones** — avoid duplication

## Schema (Wiki Operating Rules)

### Page Conventions

- All wiki pages include YAML frontmatter: `type` (entity/requirement/decision/note), `title`, `created`, `updated`
- All wiki pages use `[[wikilink]]` syntax for cross-references
- `index.md` entries: `- [[wiki/category/filename]] -- one-line description`, grouped by section (Entities | Requirements | Decisions | Notes)
- `log.md` entries prefixed with `## [YYYY-MM-DD] verb | subject` — verbs: `init` | `ingest` | `decision` | `query` | `lint` | `update`

### Page Templates

**Entity page:**
```markdown
---
type: entity
title: Entity Name
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
# Entity Name

## Properties
- ...

## Relationships
- ...

## Business Rules
- ...

## Seed Data
| Column | Value |
|--------|-------|
```

**Requirement page:**
```markdown
---
type: requirement
title: Part N — Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
source: "[[raw/source-name]]"
---
# Part N: Title

## Overview
...

## Operations / Features
- ...

## Constraints
- ...

## Acceptance Criteria
- [ ] ...
```

**Decision page (ADR):**
```markdown
---
type: decision
title: NNN — Decision Title
created: YYYY-MM-DD
status: accepted | superseded | deprecated
---
# ADR-NNN: Decision Title

## Context
What is the issue or situation?

## Decision
What was decided?

## Consequences
What are the trade-offs?
```

**Note page:**
```markdown
---
type: note
title: Note Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
# Note Title

Freeform content — implementation findings, gotchas, research.
```

### Workflows

**Ingest** — when a new source is added to `raw/`:
1. Read the source document
2. Write/update relevant wiki pages (entities, requirements, notes)
3. Update `wiki/index.md` with any new pages
4. Update `wiki/overview.md` if the source materially changes the project understanding
5. Append an entry to `wiki/log.md`

**Query** — when asked a question about the project:
1. Read `wiki/index.md` to find relevant pages
2. Read those pages
3. Synthesize answer with `[[page]]` citations
4. If the answer is valuable, offer to file it as a new wiki page

**Record Decision** — when an architectural or implementation decision is made:
1. Determine next ADR number from `wiki/decisions/`
2. Write `wiki/decisions/NNN-kebab-title.md` using the ADR template
3. Cross-link from relevant entity/requirement pages
4. Update `wiki/index.md`
5. Append an entry to `wiki/log.md`

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

A `## Project Wiki` section will be added to CLAUDE.md, coexisting with the existing `## Documentation` section:
- `docs/` (Diataxis) is for human-authored documentation — tutorials, how-to guides, reference, concepts
- `wiki/` is for LLM-maintained project knowledge — entity breakdowns, requirement analysis, decisions, findings

The CLAUDE.md section will contain:
- Wiki location (`wiki/`) and its purpose
- Instructions to read `wiki/index.md` before answering project questions
- The four workflows (ingest, query, record decision, lint)
- Ground rules and page conventions

## Trade-offs

- **Chose flat structure over heavy categorization** — this is a single take-home project, not a multi-month research effort. Four folders (entities, requirements, decisions, notes) is enough.
- **Chose index-based navigation over search tooling** — at the expected scale (~20-30 pages), the index file is sufficient. No need for embedding-based search.
- **Wiki is LLM-maintained** — the user reads it in Obsidian or the editor; Claude writes and maintains all pages.
