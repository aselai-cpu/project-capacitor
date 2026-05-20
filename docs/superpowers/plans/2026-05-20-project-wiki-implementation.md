# Project Wiki (Second Brain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the wiki directory structure, ingest the HTX take-home PDF as the first source, and add the wiki schema to CLAUDE.md so future sessions can operate the wiki.

**Architecture:** Flat wiki with four content folders (entities, requirements, decisions, notes), an index for navigation, and a log for chronological tracking. The schema lives in CLAUDE.md. Content is extracted from the PDF source document.

**Tech Stack:** Markdown files, YAML frontmatter, wikilink syntax

**Spec:** `docs/superpowers/specs/2026-05-20-project-wiki-design.md`

---

### Task 1: Create directory structure and move PDF to raw/

**Files:**
- Create: `raw/` directory
- Create: `wiki/` directory
- Create: `wiki/entities/` directory
- Create: `wiki/requirements/` directory
- Create: `wiki/decisions/` directory
- Create: `wiki/notes/` directory
- Move: `Software Engineering Take Home Test v2.0.pdf` → `raw/Software Engineering Take Home Test v2.0.pdf`

- [ ] **Step 1: Create all directories**

```bash
mkdir -p raw wiki/entities wiki/requirements wiki/decisions wiki/notes
```

- [ ] **Step 2: Move the PDF to raw/**

```bash
mv "Software Engineering Take Home Test v2.0.pdf" "raw/Software Engineering Take Home Test v2.0.pdf"
```

- [ ] **Step 3: Verify structure**

```bash
find raw wiki -type d | sort
```

Expected:
```
raw
wiki
wiki/decisions
wiki/entities
wiki/notes
wiki/requirements
```

- [ ] **Step 4: Commit**

```bash
git add raw/ wiki/
git add "Software Engineering Take Home Test v2.0.pdf"
git commit -m "Scaffold wiki directory structure and move PDF to raw/

Create raw/ for immutable source documents and wiki/ with four content
subdirectories: entities, requirements, decisions, notes. Move the HTX
take-home spec PDF into raw/ as the first source document."
```

Note: git may need a `.gitkeep` in empty directories. Add one to each empty dir if needed:
```bash
touch wiki/entities/.gitkeep wiki/requirements/.gitkeep wiki/decisions/.gitkeep wiki/notes/.gitkeep
```

---

### Task 2: Create wiki/overview.md

**Files:**
- Create: `wiki/overview.md`

Read the PDF at `raw/Software Engineering Take Home Test v2.0.pdf` (all pages) before writing this file.

- [ ] **Step 1: Write overview.md**

```markdown
---
type: entity
title: Project Overview
created: 2026-05-20
updated: 2026-05-20
---
# Project Overview

Project Capacitor is a full-stack **Task Assignment** application, built as a take-home test for the xDigital AI Products Team at HTX.

## Tech Stack

- **Frontend:** TypeScript, React (or React-based framework)
- **Backend:** TypeScript, Node.js (or Node.js-based framework)
- **Database:** PostgreSQL
- **Containerization:** Docker / docker-compose
- **AI Integration:** LLM API (e.g. Gemini) for skill identification

## Scope

The application has 7 parts, to be completed in 3-5 calendar days:

1. **[[wiki/requirements/part1-database|Part 1: Database Design & Setup]]** — PostgreSQL schema for [[wiki/entities/developer|Developers]], [[wiki/entities/task|Tasks]], and [[wiki/entities/skill|Skills]] with seed data
2. **[[wiki/requirements/part2-backend-api|Part 2: Backend API]]** — CRUD operations for Tasks, read operations for Developers and Skills
3. **[[wiki/requirements/part3-frontend|Part 3: Frontend SPA]]** — Task List page and Task Creation page
4. **[[wiki/requirements/part4-subtasks|Part 4: Subtask Feature]]** — Nested subtasks with recursive structure and status cascade rules
5. **[[wiki/requirements/part5-llm-skill-id|Part 5: LLM Skill Identification]]** — Auto-identify required skills from task title using LLM
6. **[[wiki/requirements/part6-containerization|Part 6: Containerization]]** — Docker/docker-compose for the full solution
7. **Part 7: Deliverables** — Push to GitHub, README with setup docs, system design, API docs

## Key Business Rules

- A Task can only be assigned to a [[wiki/entities/developer|Developer]] who has the [[wiki/entities/skill|Skill(s)]] required by the Task
- A Task can only be marked "Done" if all its subtasks are "Done"
- When a Task is created without specified Skills, the backend auto-identifies them via LLM
```

- [ ] **Step 2: Commit**

```bash
git add wiki/overview.md
git commit -m "Add wiki overview page

Synthesize the HTX take-home spec into a project overview covering tech
stack, scope (7 parts), and key business rules with wikilinks to entity
and requirement pages."
```

---

### Task 3: Create entity pages (developer.md, task.md, skill.md)

**Files:**
- Create: `wiki/entities/developer.md`
- Create: `wiki/entities/task.md`
- Create: `wiki/entities/skill.md`

Read the PDF at `raw/Software Engineering Take Home Test v2.0.pdf` (pages 1-3) for entity definitions and seed data.

- [ ] **Step 1: Write wiki/entities/developer.md**

```markdown
---
type: entity
title: Developer
created: 2026-05-20
updated: 2026-05-20
---
# Developer

## Properties

- **name** — string, identifies the developer (e.g. Alice, Bob)
- **skills** — list of [[wiki/entities/skill|Skills]] the developer possesses

## Relationships

- Has many [[wiki/entities/skill|Skills]] (many-to-many)
- Can be assigned many [[wiki/entities/task|Tasks]]

## Business Rules

- A Developer can only be assigned a [[wiki/entities/task|Task]] if the Developer possesses all [[wiki/entities/skill|Skills]] required by the Task
- A Developer can have multiple Skills (e.g. Frontend and Backend)

## Seed Data

| Developer | Skills             |
|-----------|--------------------|
| Alice     | Frontend           |
| Bob       | Backend            |
| Carol     | Frontend, Backend  |
| Dave      | Backend            |
```

- [ ] **Step 2: Write wiki/entities/task.md**

```markdown
---
type: entity
title: Task
created: 2026-05-20
updated: 2026-05-20
---
# Task

## Properties

- **title** — string, user story format (e.g. "As a visitor, I want to see a responsive homepage...")
- **required skills** — list of [[wiki/entities/skill|Skills]] needed (e.g. Frontend, Backend, or both)
- **status** — one of: "To-do", "Done", etc.
- **assignee** — optional, a [[wiki/entities/developer|Developer]]
- **subtasks** — optional, list of child Tasks (see [[wiki/requirements/part4-subtasks|Part 4]])

## Relationships

- Requires one or more [[wiki/entities/skill|Skills]]
- Assigned to zero or one [[wiki/entities/developer|Developer]]
- Can have child Tasks (subtasks), each with the same properties
- Can be a child of a parent Task

## Business Rules

- A Task can only be assigned to a [[wiki/entities/developer|Developer]] who has all required [[wiki/entities/skill|Skills]]
- A Task can have its status changed (e.g. "To-do" → "Done")
- A Task can only be marked "Done" if all its subtasks have status "Done" (see [[wiki/requirements/part4-subtasks|Part 4]])
- When created without specified Skills, required Skills are auto-identified by LLM from the title (see [[wiki/requirements/part5-llm-skill-id|Part 5]])
- At creation time, a Developer does not need to be assigned
```

- [ ] **Step 3: Write wiki/entities/skill.md**

```markdown
---
type: entity
title: Skill
created: 2026-05-20
updated: 2026-05-20
---
# Skill

## Properties

- **name** — string, identifies the skill (e.g. "Frontend", "Backend")

## Relationships

- Possessed by many [[wiki/entities/developer|Developers]] (many-to-many)
- Required by many [[wiki/entities/task|Tasks]]

## Business Rules

- A Skill is not unique to a Developer — multiple Developers can have the same Skill
- The initial set of Skills is "Frontend" and "Backend"
- The LLM skill identification feature (see [[wiki/requirements/part5-llm-skill-id|Part 5]]) maps task titles to these Skills
```

- [ ] **Step 4: Commit**

```bash
git add wiki/entities/
git commit -m "Add wiki entity pages for Developer, Task, and Skill

Extract entity definitions, properties, relationships, business rules,
and seed data from the HTX spec. Cross-linked with wikilinks."
```

---

### Task 4: Create requirement pages (parts 1-3)

**Files:**
- Create: `wiki/requirements/part1-database.md`
- Create: `wiki/requirements/part2-backend-api.md`
- Create: `wiki/requirements/part3-frontend.md`

Read the PDF at `raw/Software Engineering Take Home Test v2.0.pdf` (pages 2-4) for requirements.

- [ ] **Step 1: Write wiki/requirements/part1-database.md**

```markdown
---
type: requirement
title: Part 1 — Database Design & Setup
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 1: Database Design & Setup

## Overview

Create a PostgreSQL database supporting [[wiki/entities/developer|Developers]], [[wiki/entities/task|Tasks]], and [[wiki/entities/skill|Skills]] with the business logic defined in the spec.

## Operations / Features

- 1.1: Create PostgreSQL schema for all entities and their relationships
- 1.2: Seed the database with initial Developer and Skill data

## Constraints

- Must use PostgreSQL
- Developer-Skill is many-to-many
- Task-Skill is many-to-many
- Task-Developer is many-to-one (a Task has at most one assignee)
- Task self-references for subtasks (see [[wiki/requirements/part4-subtasks|Part 4]])

## Acceptance Criteria

- [ ] Schema supports Developers with name and skills
- [ ] Schema supports Tasks with title, required skills, status, and optional assignee
- [ ] Schema supports Skills as a shared resource (many-to-many with Developers)
- [ ] Seed data matches spec: Alice (Frontend), Bob (Backend), Carol (Frontend + Backend), Dave (Backend)
```

- [ ] **Step 2: Write wiki/requirements/part2-backend-api.md**

```markdown
---
type: requirement
title: Part 2 — Backend API Implementation
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 2: Backend API Implementation

## Overview

Create backend API using TypeScript / Node.js for CRUD operations on [[wiki/entities/task|Tasks]] and read operations on [[wiki/entities/developer|Developers]] and [[wiki/entities/skill|Skills]].

## Operations / Features

### Tasks
- **Create** — A new Task can be created
- **Read** — A Task and all its relevant properties can be read
- **Update** — A Task can be assigned to a Developer (with skill validation), and its status can be changed

### Developers
- **Read** — A Developer and all their relevant properties can be read

### Skills
- **Read** — A Skill and all its relevant properties can be read

## Constraints

- Must use TypeScript with Node.js or a Node.js-based framework
- Task assignment must validate that the Developer has the required Skill(s)
- No delete operations specified

## Acceptance Criteria

- [ ] POST endpoint to create a Task
- [ ] GET endpoint to read a Task with all properties
- [ ] PUT/PATCH endpoint to assign a Developer to a Task (validates skills)
- [ ] PUT/PATCH endpoint to update a Task's status
- [ ] GET endpoint to read a Developer with properties
- [ ] GET endpoint to read Skills
```

- [ ] **Step 3: Write wiki/requirements/part3-frontend.md**

```markdown
---
type: requirement
title: Part 3 — Frontend Implementation
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 3: Frontend Implementation

## Overview

Create a single-page application (SPA) using TypeScript, React or a React-based framework.

## Operations / Features

### Task List Page
- All existing Tasks listed with their relevant attributes
- A Task can be assigned to a [[wiki/entities/developer|Developer]] with the required [[wiki/entities/skill|Skill(s)]]
- The status of a Task can be updated
- Wireframe: table with columns — Task Title, Skills, Status (dropdown), Assignee (dropdown)

### Task Creation Page
- A new Task can be created by submitting a form
- User can specify required Skill(s) at creation time
- User does NOT need to assign a Developer at creation time
- Wireframe: form with a "New Task Component" and a Save button

## Constraints

- Must use TypeScript with React or React-based framework
- SPA (single-page application)

## Acceptance Criteria

- [ ] Task List page displays all tasks with title, skills, status, assignee
- [ ] Status can be changed via dropdown on Task List page
- [ ] Developer can be assigned via dropdown (filtered by required skills)
- [ ] Task Creation page with form for title and skill selection
- [ ] Save button creates the task via API
```

- [ ] **Step 4: Commit**

```bash
git add wiki/requirements/part1-database.md wiki/requirements/part2-backend-api.md wiki/requirements/part3-frontend.md
git commit -m "Add wiki requirement pages for Parts 1-3

Extract database, backend API, and frontend requirements from the HTX
spec with operations, constraints, and acceptance criteria."
```

---

### Task 5: Create requirement pages (parts 4-6)

**Files:**
- Create: `wiki/requirements/part4-subtasks.md`
- Create: `wiki/requirements/part5-llm-skill-id.md`
- Create: `wiki/requirements/part6-containerization.md`

Read the PDF at `raw/Software Engineering Take Home Test v2.0.pdf` (pages 5-6) for requirements.

- [ ] **Step 1: Write wiki/requirements/part4-subtasks.md**

```markdown
---
type: requirement
title: Part 4 — Subtask Feature
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 4: Subtask Feature

## Overview

Extend [[wiki/entities/task|Tasks]] to support nested subtasks. Each subtask has the same properties as a Task. Subtasks can be nested arbitrarily deep.

## Operations / Features

- 4.1: Modify database schema to support subtasks (self-referencing Task)
- 4.2: Implement status cascade rule — a Task can only be marked "Done" if all its subtasks are "Done"
- 4.3: Modify Task Creation page to support creating subtasks and nested subtasks dynamically

### Frontend Behavior
- "Add Subtask" button next to each task component
- Additional React components rendered dynamically on the same page
- Nested visual indentation (wireframe shows 3 levels: Task 1 → 1.1 → 1.1.1, 1.1.2)

## Constraints

- Subtasks have the same properties as Tasks (title, skills, status, assignee)
- Recursive/self-referencing relationship in the database
- Status cascade is enforced — parent cannot be "Done" unless all children are "Done"

## Acceptance Criteria

- [ ] Database schema supports self-referencing Task (parent_id or equivalent)
- [ ] API enforces: parent Task cannot be set to "Done" if any subtask is not "Done"
- [ ] Task Creation page renders "Add Subtask" buttons dynamically
- [ ] Subtasks can be nested (subtask of a subtask)
- [ ] Each subtask has its own title, skills, status, assignee fields
```

- [ ] **Step 2: Write wiki/requirements/part5-llm-skill-id.md**

```markdown
---
type: requirement
title: Part 5 — Skill Identification Using LLM
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 5: Skill Identification Using LLM

## Overview

Use an LLM to automatically identify required [[wiki/entities/skill|Skills]] for [[wiki/entities/task|Tasks]] and subtasks that don't have user-specified skills.

## Operations / Features

- 5.1: Given a Task title, the LLM identifies required Skills (Frontend, Backend, or both)
- 5.2: Integrate backend with an LLM API (e.g. Gemini, which offers free access)
- 5.3: Automatic — no manual trigger needed on the frontend. When a Task (including subtask) is created without skills, the backend auto-generates them via LLM

### Examples from Spec
- "As a visitor, I want to see a responsive homepage..." → **Frontend**
- "As a system administrator, I want audit logs..." → **Backend**
- "As a logged-in user, I want to update my profile and upload a profile picture..." → **Frontend, Backend**

## Constraints

- Must use an LLM API (any provider — Gemini suggested for free access)
- Triggered automatically on the backend at task creation time
- Only runs when user has not specified Skills

## Acceptance Criteria

- [ ] Backend integrates with an LLM API
- [ ] When a Task is created without skills, the backend calls the LLM to identify them
- [ ] LLM correctly maps task titles to Frontend, Backend, or both
- [ ] Works for subtasks as well as top-level tasks
```

- [ ] **Step 3: Write wiki/requirements/part6-containerization.md**

```markdown
---
type: requirement
title: Part 6 — Containerize Solution
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 6: Containerize Solution

## Overview

Containerize the entire solution (frontend, backend, database) using Docker so it can be run with a single `docker-compose` command.

## Operations / Features

- 6.1: Containerize all components including dependencies
- 6.2: Provide a docker-compose configuration for the full stack

## Constraints

- Must use Docker
- Must be executable via docker-compose
- Must include all dependencies (no manual setup outside of Docker)

## Acceptance Criteria

- [ ] Dockerfile(s) for frontend and backend
- [ ] docker-compose.yml orchestrates frontend, backend, and PostgreSQL
- [ ] `docker-compose up` starts a fully operational application
- [ ] No manual dependency installation required outside Docker
```

- [ ] **Step 4: Commit**

```bash
git add wiki/requirements/part4-subtasks.md wiki/requirements/part5-llm-skill-id.md wiki/requirements/part6-containerization.md
git commit -m "Add wiki requirement pages for Parts 4-6

Extract subtask, LLM skill identification, and containerization
requirements from the HTX spec with constraints and acceptance criteria."
```

---

### Task 6: Create index.md and log.md

**Files:**
- Create: `wiki/index.md`
- Create: `wiki/log.md`

- [ ] **Step 1: Write wiki/index.md**

```markdown
# Wiki Index

Content catalog for Project Capacitor wiki. Read this first.

## Entities

- [[wiki/entities/developer]] -- Developer entity: name, skills, task assignments, seed data
- [[wiki/entities/task]] -- Task entity: title, required skills, status, assignee, subtask rules
- [[wiki/entities/skill]] -- Skill entity: name, many-to-many with developers and tasks

## Requirements

- [[wiki/requirements/part1-database]] -- Part 1: PostgreSQL schema, entities, seed data
- [[wiki/requirements/part2-backend-api]] -- Part 2: CRUD for Tasks, read for Developers/Skills
- [[wiki/requirements/part3-frontend]] -- Part 3: SPA with Task List and Task Creation pages
- [[wiki/requirements/part4-subtasks]] -- Part 4: Nested subtasks, status cascade rules
- [[wiki/requirements/part5-llm-skill-id]] -- Part 5: LLM auto-identifies required skills from task title
- [[wiki/requirements/part6-containerization]] -- Part 6: Docker/docker-compose for full stack

## Decisions

(none yet)

## Notes

(none yet)
```

- [ ] **Step 2: Write wiki/log.md**

```markdown
# Wiki Log

Append-only chronological record of wiki activity.

## [2026-05-20] init | Project wiki created

Scaffolded wiki directory structure with entities/, requirements/, decisions/, notes/.

## [2026-05-20] ingest | Software Engineering Take Home Test v2.0.pdf

Source: `[[raw/Software Engineering Take Home Test v2.0.pdf]]`

Pages created:
- [[wiki/overview]] — project synthesis
- [[wiki/entities/developer]], [[wiki/entities/task]], [[wiki/entities/skill]] — entity pages
- [[wiki/requirements/part1-database]] through [[wiki/requirements/part6-containerization]] — 6 requirement pages
- [[wiki/index]] — content catalog
```

- [ ] **Step 3: Commit**

```bash
git add wiki/index.md wiki/log.md
git commit -m "Add wiki index and activity log

Create index.md as the content catalog (entities, requirements,
decisions, notes sections) and log.md with init and first ingest entries."
```

---

### Task 7: Update CLAUDE.md with wiki schema

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Project Wiki section to CLAUDE.md**

Append the following after the `## Documentation` section:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Add Project Wiki schema to CLAUDE.md

Define wiki ground rules, page conventions, and four workflows (ingest,
query, record decision, lint) so future Claude sessions can operate the
wiki autonomously."
```

---

### Task 8: Clean up .gitkeep files and final verification

**Files:**
- Remove: `wiki/entities/.gitkeep`, `wiki/requirements/.gitkeep` (if created — they now have content)
- Keep: `wiki/decisions/.gitkeep`, `wiki/notes/.gitkeep` (still empty)

- [ ] **Step 1: Remove unnecessary .gitkeep files**

```bash
rm -f wiki/entities/.gitkeep wiki/requirements/.gitkeep
```

- [ ] **Step 2: Verify final structure**

```bash
find raw wiki -type f | sort
```

Expected:
```
raw/Software Engineering Take Home Test v2.0.pdf
wiki/decisions/.gitkeep
wiki/entities/developer.md
wiki/entities/skill.md
wiki/entities/task.md
wiki/index.md
wiki/log.md
wiki/notes/.gitkeep
wiki/overview.md
wiki/requirements/part1-database.md
wiki/requirements/part2-backend-api.md
wiki/requirements/part3-frontend.md
wiki/requirements/part4-subtasks.md
wiki/requirements/part5-llm-skill-id.md
wiki/requirements/part6-containerization.md
```

- [ ] **Step 3: Verify CLAUDE.md has all sections**

```bash
grep "^## " CLAUDE.md
```

Expected:
```
## Project Overview
## Repository Status
## Git Workflow
## Documentation
## Project Wiki
```

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "Clean up .gitkeep files after wiki population

Remove .gitkeep from entities/ and requirements/ (now have content).
Retain .gitkeep in decisions/ and notes/ (still empty)."
```

- [ ] **Step 5: Push to remote**

```bash
git push
```
