---
type: note
title: Project Overview
created: 2026-05-20
updated: 2026-05-22

---
# Project Overview

Project Capacitor is a full-stack **AI-Assisted Task Allocation** application, built as a take-home test for the xDigital AI Products Team at HTX. The app helps project managers allocate tasks to developers based on AI-scored skill matching.

## Tech Stack

- **Frontend:** TypeScript, React 19, React Router v7, Tailwind CSS, Vite, @dnd-kit/core
- **Backend:** TypeScript, Express.js, Prisma v7, Zod, Pino
- **Database:** PostgreSQL 15
- **LLM:** Vercel AI SDK — auto-detects Google/OpenAI/Anthropic/Moonshot from API key
- **Observability:** Grafana (UI), Tempo (traces), Loki (logs), Langfuse v3 (GenAI traces)
- **Containerization:** Docker Compose (12 services)

## Core Features

### Original Spec (7 parts)
1. **Database Design** — PostgreSQL schema for Developers, Tasks, Skills with seed data
2. **Backend API** — CRUD operations for Tasks, read for Developers/Skills
3. **Frontend SPA** — Task List and Task Creation pages
4. **Subtask Feature** — Nested subtasks with status cascade rules
5. **LLM Skill Identification** — Auto-identify required skills from task title
6. **Containerization** — Docker/docker-compose for full solution
7. **Deliverables** — GitHub repo, README, system design, API docs

### UX Redesign (added)
8. **Dashboard** — Home page with metrics, allocation CTA, team workload bars
9. **Navigation Restructure** — `Dashboard | Team | Projects | Tasks(n) | Allocate(n)` with attention badges
10. **Allocation Copilot** — 3 switchable views: Matrix (score grid), Kanban (drag-and-drop board), Focus (AI reasoning split panel)
11. **AI-First Task Creation** — LLM auto-classifies skills on title blur, categorized manual override

### Rich Task Management (added)
12. **Task Detail Page** (`/tasks/:id`) — Dedicated page with header, details, recursive subtask tree, AI subtask generation
13. **Paginated Task Lists** — Project Detail page with filterable/sortable/expandable task rows
14. **AI Task Generation** — PM provides direction hint, AI generates 3-5 tasks with description, AC, Fibonacci story points, skills
15. **Subtask Management** — Recursive subtask tree with expand/collapse, delete per node, AI subtask generation at any level

### Additional Features (added)
16. **Developer CRUD** — Create/edit/delete developers with skill selection and CV upload
17. **CV Profile Builder** — PDF upload + text paste, LLM skill extraction with proficiency levels
18. **Skill Overhaul** — 16 real tech skills (flat), categorized in UI (Languages, Frameworks, Infrastructure, Data, Tools, AI/ML)
19. **Self-Hosted Langfuse** — Dockerized Langfuse v3 for GenAI observability (6 services)

## Docker Services (12)

| Service | Port | Purpose |
|---------|------|---------|
| frontend | :3000 | React SPA |
| backend | :5000 | Express API |
| db | :5433 | PostgreSQL (app) |
| tempo | internal | Trace storage |
| loki | :3100 | Log storage |
| grafana | :3001 | Observability UI |
| langfuse | :3002 | GenAI observability UI |
| langfuse-worker | internal | Event processing |
| langfuse-db | internal | PostgreSQL (Langfuse) |
| langfuse-clickhouse | internal | Trace analytics |
| langfuse-redis | internal | Event queue |
| langfuse-minio | internal | S3-compatible storage |

## Key Business Rules

- A Task can only be assigned to a [[wiki/entities/developer|Developer]] who has all the [[wiki/entities/skill|Skill(s)]] required by the Task (skill superset guard)
- A Task can only be marked "Done" if all its subtasks are "Done" (cascade guard)
- When a Task is created without specified Skills, the backend auto-identifies them via LLM
- Allocation scoring is deterministic (skill overlap %) — LLM reasoning is on-demand
- Story points use Fibonacci sequence (1, 2, 3, 5, 8, 13, 21) — AI-estimated, PM-overridable

## Key API Endpoints

### Task Management
- `GET /api/tasks` — Flat task list with filters (projectId, status, developerId)
- `GET /api/tasks/:id` — Recursive task tree with project/skills/developer
- `POST /api/tasks` — Create task (with server-side LLM skill classification fallback)
- `PATCH /api/tasks/:id` — Update status/assignee/storyPoints
- `DELETE /api/tasks/:id` — Delete task (cascades to subtasks)
- `POST /api/tasks/:id/generate-subtasks` — AI subtask generation with hint
- `POST /api/tasks/classify-skills` — Real-time AI skill classification preview

### Project Management
- `GET /api/projects/:id/tasks` — Paginated project tasks with sorting/filtering
- `POST /api/projects/:id/generate-tasks` — AI task generation with direction hint
- `POST /api/projects/:id/enrich` — AI project enrichment

### Allocation
- `GET /api/dashboard` — Aggregated metrics
- `GET /api/allocate/scores` — Skill match scoring for unassigned tasks
- `POST /api/allocate/reason` — On-demand AI reasoning per task-developer pair
