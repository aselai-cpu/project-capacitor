---
type: note
title: Gemini Design Discussion — DDD & TOGAF Exploration
created: 2026-05-20
updated: 2026-05-20
---
# Gemini Design Discussion — DDD & TOGAF Exploration

Source: `[[raw/notes/Discussion with gemini about the Project.md]]`

A 29-message conversation with Gemini exploring the project through a Domain-Driven Design and TOGAF lens. Key takeaways below.

## Core Problem Reframing

The project addresses **Skill-Constrained Resource Allocation and Dynamic Dependency Management under Automated Governance** — not just task tracking. Three organizational breakdowns it solves:

1. **Competency Gap (Misallocation Risk)** — prevents assigning tasks to unqualified developers
2. **Structural Integrity Cascading** — prevents marking parent tasks done when children are incomplete
3. **Semantic Friction** — automates skill tagging via LLM instead of error-prone manual entry

## DDD Bounded Contexts

| Context | Domain | Core Entities |
|---------|--------|---------------|
| **Capability Context** | Resource Domain | [[wiki/entities/developer\|Developer]], [[wiki/entities/skill\|Skill]] |
| **Execution Context** | Work Management Domain | [[wiki/entities/task\|Task]] (recursive aggregate) |
| **Cognitive Context** | Intelligence Domain | LLM skill inference bridge |

The Task with its subtree forms a **DDD Aggregate**, with the root Task as the **Aggregate Root**. All state changes must pass through the root to enforce invariants.

## Domain Invariants

- **Invariant A (Capability Superset):** Developer.skills must be a superset of Task.requiredSkills for assignment
- **Invariant B (Hierarchical State Cascade):** Parent status cannot be "Done" unless all children are "Done"

## Database Schema Design

Five tables with explicit join tables:
1. `skills` — id, name (unique)
2. `developers` — id, name
3. `developer_skills` — join table (developer_id, skill_id)
4. `tasks` — id, title, status (enum: TODO/DONE), parent_id (self-ref, nullable), developer_id (nullable)
5. `task_skills` — join table (task_id, skill_id)

Key decisions: UUID primary keys, `ON DELETE CASCADE` for parent_id, explicit join tables for future flexibility (e.g., adding proficiency levels).

See [[wiki/decisions/001-prisma-orm]].

## API Contract Design

| Method | Endpoint | Purpose | Guards |
|--------|----------|---------|--------|
| POST | `/api/tasks` | Create entire task tree (recursive payload) | Triggers LLM if skillIds empty |
| GET | `/api/tasks` | Fetch all tasks (flat with parentId or pre-nested) | — |
| PATCH | `/api/tasks/:id` | Update status or assignee | 422 if skill mismatch; 400 if subtask cascade violation |
| GET | `/api/developers` | All developers with skills | — |
| GET | `/api/skills` | All skill tags | — |

See [[wiki/decisions/002-recursive-task-payload]].

## Implementation Patterns

### Backend (Express + Prisma + TypeScript)
- **Recursive transformer** converts nested JSON payload to Prisma nested write format
- **Single atomic transaction** via `prisma.$transaction()` for entire tree creation
- **LLM service** (`@google/genai` SDK, Gemini 2.5 Flash) with structured prompt returning JSON array
- **Recursive tree traversal** enriches missing skills before DB write
- Error codes: 422 for skill mismatch, 400 for cascade violation, 500 for transaction failure

### Frontend (React + TypeScript)
- **Recursive interface:** `TaskFormState { id, title, skillIds, subtasks: TaskFormState[] }`
- **Immutable tree updater:** `updateNodeInTree(node, targetId, updater)` pure function
- **Recursive component:** `<TaskFormNode />` renders itself for each subtask
- **Orchestrator page:** `<CreateTaskPage />` manages root state and form submission
- Client-side UUIDs via `crypto.randomUUID()` for React keys

### Docker (Multi-stage builds)
- Backend: `node:20-alpine` builder → production runner with Prisma binary
- Frontend: `node:20-alpine` builder → `nginx:1.25-alpine` for static serving with SPA fallback
- docker-compose: db (postgres:15-alpine with healthcheck), backend (waits for healthy db), frontend (depends on backend)
- Ports: DB 5432, Backend 5000, Frontend 3000→80

See [[wiki/decisions/003-docker-multi-stage]].

## Future Vision (Not MVP)

Discussed but explicitly deferred to README "Future Target State" section:
- Dynamic capability profiling via HackerRank/code challenges
- LLM code auditing for skill assessment
- Proficiency levels (Novice/Competent/Expert)
- Growth/stretch task assignments with senior oversight flags
- Skill vectors replacing binary skill flags

## Research Papers Mentioned

1. "Research directions for using LLM in software requirement engineering" (2025) — LLM as requirements parser
2. "AI-Generated User Stories: Are They Good Enough?" (2025) — prompt structuring for deterministic output
3. "Task Assignment System for Remote Work by Skill Matching" (2025) — constraint-satisfaction approach
4. "The Software Project Staffing Problem: A Review" — SBSE for team configuration
5. "Domain-Driven Design" (Eric Evans, 2003) — Aggregates, bounded contexts
6. "Hierarchical Task Networks in Workflow Management" — state propagation in directed trees
