# Project Capacitor

Project Capacitor is a full-stack Task Assignment application built for the xDigital AI Products Team at HTX. It features skill-constrained developer assignment, recursive subtasks with status cascade rules, and automated LLM-based skill classification.

---

## Quick Start

**Prerequisites:** Docker, Docker Compose, and an API key from any supported LLM provider.

```bash
# 1. Clone the repository
git clone <repo-url> && cd project-capacitor

# 2. Set your LLM API key (pick ONE — auto-detected)
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-key" > .env   # Google Gemini (free tier available)
# OR
echo "OPENAI_API_KEY=your-key" > .env                  # OpenAI
# OR
echo "ANTHROPIC_API_KEY=your-key" > .env               # Anthropic Claude
# OR
echo "MOONSHOT_API_KEY=your-key" > .env                # Moonshot Kimi

# 3. Start the full stack
docker-compose up --build

# 4. Open the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api/health (shows active LLM provider)
```

The database is automatically initialized with seed data (4 developers, 2 skills).

---

## System Design

Three bounded contexts (Domain-Driven Design):

- **Capability Context:** Developers and Skills (static, seeded)
- **Execution Context:** Tasks with recursive subtask trees (Aggregate Root pattern)
- **Cognitive Context:** LLM skill classification bridge (transient)

Two domain invariants:

- **Capability Superset Rule:** A task can only be assigned to a developer whose skills are a superset of the task's required skills
- **Hierarchical Status Cascade:** A task can only be marked "Done" if all its subtasks are "Done"

Entity relationships:

- Developer ↔ Skill: many-to-many
- Task ↔ Skill: many-to-many
- Task → Developer: many-to-one (optional)
- Task → Task: self-referencing (subtasks, unbounded depth)

---

## Tech Stack & Library Justifications

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Database | PostgreSQL + Prisma ORM | Type-safe queries, schema-first migrations, native nested writes for recursive subtask trees |
| Backend | Express + TypeScript + Zod | Industry-standard Node.js framework, Zod provides runtime type validation matching TypeScript types |
| Frontend | Vite + React 19 + React Router v7 + Tailwind CSS | Fastest SPA build tool, React's component model ideal for recursive subtask forms, Tailwind accelerates styling |
| LLM | Vercel AI SDK (Google/OpenAI/Anthropic/Moonshot) | Provider-agnostic — auto-detects provider from API key. `generateObject()` with Zod for type-safe structured output |
| Infrastructure | Docker + docker-compose | Single-command deployment, PostgreSQL healthcheck ensures DB ready before backend starts |

---

## API Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List all tasks (flat array with depth field for indentation) |
| GET | /api/tasks/:id | Get single task with recursive subtask tree |
| POST | /api/tasks | Create task or task tree (with optional recursive subtasks) |
| PATCH | /api/tasks/:id | Update task status or assignee (with invariant guards) |
| GET | /api/developers | List all developers with skills |
| GET | /api/developers/:id | Get single developer with skills |
| GET | /api/skills | List all skills |

Key behaviors:

- `POST /api/tasks`: If `skillIds` is empty, the backend automatically classifies required skills via LLM
- `PATCH` with `status: "DONE"`: Returns 400 if any subtask is not Done (Invariant B)
- `PATCH` with `developerId`: Returns 422 if developer lacks required skills (Invariant A)

---

## Design Assumptions

These assumptions were made for ambiguities in the spec:

1. **Status values:** TODO, IN_PROGRESS, DONE — all transitions allowed, only DONE entry guarded by cascade rule
2. **Task List display:** Flat table with all tasks (root + subtasks), visually indented by depth
3. **Subtask creation:** Create page only (per spec Part 4.3), with "Add Subtask" link from List page
4. **LLM timing:** Synchronous with 5s batch timeout, parallelized for multiple nodes, fail-open on error
5. **API granularity:** Both flat list and recursive tree endpoints for tasks

---

## Observability (Optional)

The backend includes a full observability stack — all optional, zero-config:

### Structured Logging (Pino)
Every request is logged as structured JSON with method, URL, status, and duration. Dev mode uses `pino-pretty` for readable output. Set `LOG_LEVEL=debug` for verbose logging.

### Distributed Tracing (OpenTelemetry)
Auto-instruments Express HTTP requests, PostgreSQL queries, and outbound LLM API calls. In dev mode, spans are printed to console. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to export to Jaeger, Zipkin, or Grafana Tempo.

### GenAI Observability (Langfuse)
Traces every LLM skill classification call — latency, token usage, cost, prompt/response pairs. Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` to enable. Sign up free at [langfuse.com](https://langfuse.com).

---

## Future Improvements

- Upgrade to collapsible tree-table on Task List page for better UX at scale
- Add Nginx reverse proxy to eliminate CORS (production deployment)
- ~~Multi-provider LLM support~~ ✅ Implemented — auto-detects Google/OpenAI/Anthropic from API key
- Proficiency levels on Developer-Skill relationship (Novice/Competent/Expert)
- Pagination for task list endpoint (cursor-based)
- Multi-stage Docker builds for smaller production images

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GOOGLE_GENERATIVE_AI_API_KEY | One of these | Google Gemini API key (free tier at ai.google.dev) |
| OPENAI_API_KEY | required | OpenAI API key |
| ANTHROPIC_API_KEY | | Anthropic Claude API key |
| MOONSHOT_API_KEY | | Moonshot Kimi API key |
| LLM_PROVIDER | No | Force provider: `google`, `openai`, `anthropic`, or `moonshot` (auto-detected if not set) |
| LLM_MODEL | No | Override model name (e.g., `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-2.5-flash`, `kimi-k2.5`) |

Set **one** API key — the app auto-detects which provider to use. The `DATABASE_URL` and PostgreSQL credentials are pre-configured in `docker-compose.yml`.
