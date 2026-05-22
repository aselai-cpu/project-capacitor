# Project Capacitor

Enterprise-grade task assignment platform with AI-powered project kickstart, skill extraction from CVs, workload-balanced developer allocation, and full observability. Built for the xDigital AI Products Team at HTX.

> **Demo:** [Watch the 45-second feature walkthrough](docs/demo.webm) — Dashboard, Projects, Tasks, Team, Allocation views, Kickstart, Grafana logs, Langfuse traces.

---

## Quick Start

**Prerequisites:** Docker, Docker Compose, and an API key from any supported LLM provider.

```bash
# 1. Clone the repository
git clone <repo-url> && cd project-capacitor

# 2. Configure LLM provider — set ONE key in .env (auto-detected)
cp .env.example .env
# Edit .env and set one of:
#   GOOGLE_GENERATIVE_AI_API_KEY=...   (Google Gemini — free tier available)
#   OPENAI_API_KEY=...                  (OpenAI)
#   ANTHROPIC_API_KEY=...               (Anthropic Claude)
#   MOONSHOT_API_KEY=...                (Moonshot Kimi)

# 3. Start the full stack (12 services)
docker-compose up --build

# 4. Open the app
#   Frontend:       http://localhost:3000
#   Backend API:    http://localhost:5000/api/health
#   Grafana:        http://localhost:3001
#   Langfuse:       http://localhost:3002  (admin@capacitor.dev / admin123)
#   pgAdmin:        http://localhost:5050
```

The database is seeded with sample data (developers, skills, projects, tasks).

---

## Features

### Kickstart — Agentic Project Setup
Single-page workflow: enter a project description + select team members → AI agent autonomously enriches the project, generates 10-15 tasks with story points, extracts skills from CVs, and assigns developers with workload-balanced allocation. Live progress streamed via SSE.

### Project Management
Create projects with AI enrichment (generates tech stack, architecture, domain, requirements, constraints). Generate user stories and development tasks from project context with directional hints.

### Task Management
Recursive subtask trees with unlimited depth. Status cascade guards (can't mark parent "Done" unless all subtasks are "Done"). AI-powered skill classification on task creation. Story point estimation. Inline status and assignee changes.

### Developer Profiles & CV Parsing
Upload PDF CVs or paste text — AI extracts skills with proficiency levels (beginner/intermediate/advanced/expert), professional bio, and work experience. Skills are auto-created and linked to the developer.

### Allocation Copilot
Three visualization modes for task-developer assignment:
- **Matrix View** — Tasks vs developers grid with skill match percentages
- **Kanban View** — Drag-and-drop assignment with unassigned tasks grouped
- **Focus View** — Single task focus with ranked developer recommendations

AI-generated reasoning for each assignment. "Top Pick" recommendations based on skill match and workload balance.

### Dashboard
Project summaries, unassigned task counts, team workload distribution.

---

## Architecture

### C4 Diagrams

PlantUML C4 architecture diagrams in `docs/reference/`:

| Diagram | File | Description |
|---------|------|-------------|
| Level 1: Context | `c4-context.puml` | Users, Capacitor system, LLM providers, Langfuse |
| Level 2: Container | `c4-container.puml` | All 12 Docker services across application, observability, and Langfuse stacks |
| Level 3: Component | `c4-component.puml` | Backend internals — routes, services, Prisma ORM, instrumentation |

Render with any PlantUML tool (VS Code extension, IntelliJ, or [plantuml.com](https://www.plantuml.com/plantuml)).

### System Design

Three bounded contexts (Domain-Driven Design):

- **Capability Context:** Developers and Skills
- **Execution Context:** Tasks with recursive subtask trees (Aggregate Root pattern)
- **Cognitive Context:** LLM-powered skill classification, project enrichment, task generation, CV parsing, and balanced assignment

Domain invariants:

- **Skill Compatibility Rule:** A task can only be assigned to a developer with at least one matching skill (adjacent skills permitted)
- **Hierarchical Status Cascade:** A task can only be marked "Done" if all its subtasks are "Done"

Entity relationships:

- Developer ↔ Skill: many-to-many
- Task ↔ Skill: many-to-many
- Task → Developer: many-to-one (optional)
- Task → Task: self-referencing (subtasks, unbounded depth)
- Task → Project: many-to-one (optional)

---

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Database | PostgreSQL 15 + Prisma ORM | Type-safe queries, schema-first migrations, native nested writes for recursive subtask trees |
| Backend | Express + TypeScript + Zod | REST API with SSE streaming. Zod provides runtime type validation matching TypeScript types |
| Frontend | Vite + React 19 + React Router v7 + Tailwind CSS | Fast SPA builds, component model for recursive forms, Tailwind for rapid styling |
| LLM | Vercel AI SDK (4 providers) | Provider-agnostic — auto-detects from API key. `generateObject()` with Zod for type-safe structured output |
| Observability | Grafana + Loki + Tempo | Structured logging (pino → Loki), distributed tracing (OTLP → Tempo), unified Grafana dashboards |
| GenAI Observability | Self-hosted Langfuse v3 | Traces every LLM call with latency, token usage, cost, prompt/response. Full local stack with ClickHouse + Redis + MinIO |
| Infrastructure | Docker Compose (12 services) | Single-command deployment with health checks and dependency ordering |

### LLM Provider Configuration

| Env var | Provider | Default model |
|---------|----------|---------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini | gemini-2.5-flash |
| `OPENAI_API_KEY` | OpenAI | gpt-4o-mini |
| `ANTHROPIC_API_KEY` | Anthropic | claude-haiku-4-5-20251001 |
| `MOONSHOT_API_KEY` | Moonshot Kimi | kimi-k2.5 |

Set **one** key — auto-detected. Override with `LLM_PROVIDER` and `LLM_MODEL` env vars. No key = fail-open (tasks created without AI skills).

---

## API Documentation

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks (flat with depth). Filter: `?projectId=&status=&developerId=` |
| GET | `/api/tasks/:id` | Get task with recursive subtask tree |
| POST | `/api/tasks` | Create task or task tree. Auto-classifies skills via LLM if `skillIds` empty |
| PATCH | `/api/tasks/:id` | Update status/assignee/storyPoints. Guards: cascade + skill check |
| DELETE | `/api/tasks/:id` | Delete task and all subtasks (cascade) |
| POST | `/api/tasks/:id/recommend-assignee` | AI-recommended developer for a task |
| POST | `/api/tasks/:id/generate-subtasks` | AI subtask generation with direction hint |
| POST | `/api/tasks/classify-skills` | Preview AI skill classification for a title |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project with task summaries |
| GET | `/api/projects/:id/tasks` | Paginated tasks. Filter: `?status=&developerId=&sortBy=&page=&limit=` |
| POST | `/api/projects` | Create project (name + description) |
| PATCH | `/api/projects/:id` | Update project fields |
| DELETE | `/api/projects/:id` | Delete project (cascades to tasks) |
| POST | `/api/projects/:id/enrich` | AI project enrichment (tech stack, architecture, domain, etc.) |
| POST | `/api/projects/:id/generate-stories` | AI user story generation (Gherkin format) |
| POST | `/api/projects/:id/generate-tasks` | AI task generation with direction hint |

### Developers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/developers` | List all developers with skills |
| GET | `/api/developers/:id` | Get developer with skills |
| POST | `/api/developers` | Create developer |
| PATCH | `/api/developers/:id` | Update developer (name, bio, skills) |
| DELETE | `/api/developers/:id` | Delete developer |
| POST | `/api/developers/:id/upload-cv` | Upload PDF CV — AI skill extraction |
| POST | `/api/developers/:id/extract-skills` | Paste CV text — AI skill extraction |

### Allocation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/allocate/scores` | All unassigned tasks with developer match scores. Filter: `?projectId=` |
| POST | `/api/allocate/reason` | AI-generated reasoning for a task-developer pair |

### Agent (Kickstart)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/kickstart` | Agentic project setup. Multipart form → SSE stream. 4-step pipeline: enrich → generate tasks ∥ process team → assign & balance |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (DB + LLM provider status) |
| GET | `/api/skills` | List all skills |
| GET | `/api/dashboard` | Aggregated metrics |

---

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | React SPA (served via `serve`) |
| backend | 5000 | Express API server |
| db | 5433 | PostgreSQL 15 (application data) |
| grafana | 3001 | Grafana dashboards (logs + traces) |
| loki | 3100 | Log aggregation (receives pino-loki push) |
| tempo | — | Distributed tracing (OTLP receiver) |
| langfuse | 3002 | GenAI observability UI |
| langfuse-worker | — | Background trace processing |
| langfuse-db | — | PostgreSQL for Langfuse metadata |
| langfuse-clickhouse | — | ClickHouse for Langfuse analytics |
| langfuse-redis | — | Redis for Langfuse job queues |
| langfuse-minio | — | S3-compatible storage for events |
| pgadmin | 5050 | PostgreSQL admin UI |

---

## Development

```bash
# Backend (local dev — requires PostgreSQL on port 5433)
cd backend && npm install && npm run dev    # Port 5000

# Frontend (local dev)
cd frontend && npm install && npm run dev   # Port 5173

# Run tests
cd backend && npm test                      # 88 unit tests
cd frontend && npm test                     # 32 unit tests

# E2E tests (requires both backend + frontend running)
npx playwright test                         # 8 E2E tests

# Type check
cd backend && npm run build                 # TypeScript compile
cd frontend && npm run build                # TypeScript + Vite build
```

---

## Observability

### Structured Logging (Pino → Loki)
Every request logged as structured JSON. Dev mode uses `pino-pretty`. In Docker, logs push to Loki via pino-loki. Set `LOG_LEVEL=debug` for verbose output.

### Distributed Tracing (OpenTelemetry → Tempo)
Auto-instruments Express HTTP requests, PostgreSQL queries, and outbound LLM API calls. OTLP traces sent to Tempo. View in Grafana → Explore → Tempo.

### GenAI Observability (Langfuse)
Self-hosted Langfuse v3 traces every LLM call — latency, token usage, cost, prompt/response pairs. The Kickstart agent pipeline appears as a single trace with nested spans per step. Access at http://localhost:3002 (admin@capacitor.dev / admin123).

### Grafana Dashboards
http://localhost:3001 — pre-configured with Loki and Tempo data sources. Anonymous access enabled.

---

## Documentation

Follows the [Diataxis](https://diataxis.fr/) framework:

```
docs/
├── tutorials/       # Guided learning experiences
├── how-to/          # Steps to accomplish a goal
├── reference/       # Technical descriptions, C4 diagrams
└── concepts/        # Architecture decisions and reasoning
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | One of | Google Gemini API key |
| `OPENAI_API_KEY` | these | OpenAI API key |
| `ANTHROPIC_API_KEY` | four | Anthropic Claude API key |
| `MOONSHOT_API_KEY` | | Moonshot Kimi API key |
| `LLM_PROVIDER` | No | Force provider: `google`, `openai`, `anthropic`, `moonshot` |
| `LLM_MODEL` | No | Override model (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `DATABASE_URL` | No | Pre-configured in docker-compose.yml |
| `LOKI_HOST` | No | Loki push URL (set in Docker, omit for local dev) |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
