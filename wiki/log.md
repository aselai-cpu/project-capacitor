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

## [2026-05-20] ingest | Re-ingest Software Engineering Take Home Test v2.0.pdf (gap fill)

Source: `[[raw/Software Engineering Take Home Test v2.0.pdf]]`

Gaps found on second pass:
- Part 7 (Deliverables) had no requirement page — created [[wiki/requirements/part7-deliverables]]
- "Important Notes" section (meta-constraints, assumptions, AI usage, timeline, sample tasks) was not captured — created [[wiki/notes/meta-constraints]]
- Updated [[wiki/overview]] to wikilink Part 7
- Updated [[wiki/index]] with new pages

## [2026-05-20] ingest | Discussion with gemini about the Project.md

Source: `[[raw/notes/Discussion with gemini about the Project.md]]`

29-message Gemini conversation exploring the project through DDD and TOGAF lenses. Covers database schema design, API contracts, implementation patterns (Prisma, recursive payloads, LLM integration, recursive React components), and Docker containerization strategy.

Pages created:
- [[wiki/notes/gemini-design-discussion]] — comprehensive summary of DDD framing, bounded contexts, implementation patterns
- [[wiki/decisions/001-prisma-orm]] — ADR: Prisma ORM with explicit join tables
- [[wiki/decisions/002-recursive-task-payload]] — ADR: recursive JSON payload for atomic tree creation
- [[wiki/decisions/003-docker-multi-stage]] — ADR: multi-stage Docker builds with Nginx

Pages updated:
- [[wiki/index]] — added decisions and notes entries

## [2026-05-20] ingest | Research papers (7 PDFs in raw/papers/)

Sources: `[[raw/papers/01-llm-in-requirement-engineering.pdf]]` through `[[raw/papers/06b-structural-complexity-htn-planning.pdf]]`

Ingested 7 research papers across 3 pillars referenced in the Gemini design discussion:
- Pillar 1 (LLM in RE): systematic review of 29 studies; empirical study of AI-generated user stories with US-Prompt technique
- Pillar 2 (Skill allocation): TASE skill-matching system with weighted scoring; SBSPM literature review of 52 studies
- Pillar 3 (Hierarchical state): DDD by Eric Evans (sample); HTN planning with state constraints (IJCAI-17); structural complexity analysis of HTN (arXiv 2025)

Pages created:
- [[wiki/notes/research-papers]] — consolidated summaries with project relevance for all 7 papers

Pages updated:
- [[wiki/index]] — added research papers note

## [2026-05-21] ingest | Gap-fill research papers (4 new PDFs)

Sources: `[[raw/papers/07-structured-output-benchmark.pdf]]`, `[[raw/papers/08-draft-conditioned-constrained-decoding.pdf]]`, `[[raw/papers/09-react-state-management-large-scale.pdf]]`, `[[raw/papers/10-slot-structuring-llm-output.pdf]]`

Added 2 new pillars to research coverage:
- Pillar 4 (Structured LLM Output): JSONSchemaBench benchmark (EPFL/Microsoft); DCCD two-step approach (UCF/Lockheed); SLOT post-processing framework (AWS/EMNLP 2025)
- Pillar 5 (React Architecture): Critical analysis of React's monolithic assumptions vs distributed UI — validates our SPA approach

Pages updated:
- [[wiki/notes/research-papers]] — added papers 07-10 with summaries and project relevance
- [[wiki/index]] — updated paper count (7 → 11, 3 → 5 pillars)

## [2026-05-21] decision | Use Vercel AI SDK for LLM abstraction

Supersedes the `@google/genai` direct dependency from the Gemini design discussion. Vercel AI SDK provides provider-agnostic LLM access with `generateObject()` + Zod for type-safe structured output. Default provider: Gemini, switchable via `LLM_PROVIDER` env var.

Pages created:
- [[wiki/decisions/004-vercel-ai-sdk]] — ADR with code examples, provider switching pattern, Zod schema approach

## [2026-05-21] query | Spec ambiguity analysis (solution architect review)

Analyzed the HTX spec for clarity gaps. Identified 5 ambiguities ranked by implementation risk, each with recommended assumptions:
1. Status values undefined ("etc.") — assume TODO/IN_PROGRESS/DONE enum
2. Task List subtask display unspecified — assume tree-table with expand/collapse
3. Subtask creation scope unclear (create-only vs post-creation) — assume both
4. LLM sync vs async not specified — assume synchronous with timeout fallback
5. API single vs list endpoints ambiguous — assume both GET /tasks and GET /tasks/:id

Pages created:
- [[wiki/notes/spec-ambiguities]] — full analysis with cross-links to affected requirements and decisions

## [2026-05-21] query | Ambiguity solutions (UX heuristics + architecture)

Proposed concrete solutions for all 5 spec ambiguities:
1. Three-state FSM (TODO/IN_PROGRESS/DONE) with transition rules and cascade guard
2. Expandable tree-table with lazy subtask loading and capped indent depth
3. Dual subtask creation: atomic tree on Create page + inline "+" on List page (same POST endpoint)
4. Synchronous LLM with 5s timeout, graceful degradation via skillSource enum (user/llm/pending/failed)
5. RESTful endpoints with subtaskCount on list, full recursive tree on detail, depth query param

New data model element: `skillSource` field on Task entity.

Pages created:
- [[wiki/notes/ambiguity-solutions]] — full solutions with diagrams, API shapes, frontend UX patterns

## [2026-05-21] query | Devil's advocate — blind spots & course corrections

Critical self-review of our approach. Top 5 blind spots identified:
1. Over-documentation, under-implementation — zero app code written for a 3-day test
2. Recursive payload + synchronous LLM = multiplicative latency — fix with Promise.all()
3. Three-state FSM TODO→DONE block is an invented constraint — allow all transitions, only guard Done entry
4. Explicit join tables + 3 provider adapters are YAGNI — use implicit M:N and single provider
5. Tree-table will consume half the frontend budget — build flat table first, upgrade if time permits

Recalibrated priority: ship Parts 1-6 as fast as possible, then polish.

Pages created:
- [[wiki/notes/devils-advocate-blind-spots]] — full analysis with fixes and recalibrated implementation priority

## [2026-05-21] decision | Final pre-implementation decisions (all 9 open questions)

Synthesized all analysis into definitive answers. Key decisions:
1. Status: TODO/IN_PROGRESS/DONE, free transitions, cascade guard on DONE only
2. Task List: flat table with CSS indent by depth, not tree-table
3. Subtask creation: Create page only, "Add Subtask" link from List navigates to Create with parentId
4. LLM: synchronous, Promise.allSettled() parallel, fail-open with empty skills
5. API: flat list + individual detail, minimal surface
6. ORM: Prisma implicit M:N (not explicit join tables)
7. Frontend: React + useState, no state library, React Router
8. Backend: Express + TypeScript
9. Docker: simple single-stage Dockerfiles

Implementation order: Parts 1→2→3→4→5→6→7, ~10-14 hours total.

Pages created:
- [[wiki/notes/final-decisions]] — complete Prisma schema, API table, Docker configs, backend structure, implementation timeline

## [2026-05-21] decision | Frontend framework: Vite + React + React Router

Evaluated 4 React-based frameworks against project requirements:
- Vite + React (selected) — SPA-native, 42KB bundle, simplest Docker, 2-min scaffold
- Next.js (rejected) — over-engineered, SSR/RSC not needed, 92KB bundle
- React Router v7 framework mode (rejected) — docs fragmented from Remix merger, loaders/actions unnecessary
- TanStack Start (rejected) — v1.0 only 3 months old, 15% adoption, too new for take-home test

Pages created:
- [[wiki/decisions/005-vite-react-frontend]] — ADR with full comparison table and rationale

## [2026-05-21] decision | Backend framework: Express.js with Zod

Evaluated 6 Node.js/TypeScript backend frameworks:
- Express (selected) — max evaluator recognition, fastest to ship, Zod bridges TypeScript gap
- Hono (runner-up) — 3-4x faster, native TypeScript, but low government recognition
- Fastify (rejected) — marginal gains over Express, mild friction
- NestJS (rejected) — over-engineered for 7 endpoints, 45-60 min to first endpoint
- tRPC (disqualified) — RPC not REST, violates spec
- Elysia (disqualified) — Bun-only, non-standard in government

Pages created:
- [[wiki/decisions/006-express-backend]] — ADR with Zod validation pattern and full comparison

## [2026-05-22] update | UX Redesign + Rich Task Management + Task Detail + Langfuse

Major session: implemented full UX redesign, rich task management, task detail page, and self-hosted Langfuse.

### Features implemented:
- **Dashboard** (`/dashboard`) — metrics, allocation CTA, workload bars. Default home page.
- **Allocation Copilot** (`/allocate`) — 3 views: Matrix (score grid), Kanban (drag-and-drop with @dnd-kit/core), Focus (AI reasoning split panel)
- **Navigation restructure** — `Dashboard | Team | Projects | Tasks(n) | Allocate(n)` with attention badges
- **AI-first task creation** — LLM auto-classifies skills on blur, categorized manual override
- **Project detail tabs** — spec fields as clickable tabs
- **Rich task management** — paginated/filterable/sortable task list on project detail, expandable accordion rows with description/AC/skills/editable Fibonacci story points
- **AI task generation** — PM provides direction hint, AI generates 3-5 tasks with full details
- **Task Detail page** (`/tasks/:id`) — dedicated page with subtask tree, AI subtask generation, task deletion
- **Recursive subtask management** — SubtaskTree component, expand/collapse, delete per node
- **Task deletion** — `DELETE /api/tasks/:id` with cascade
- **Removed `/tasks/new`** — inline task creation on project detail, subtask management on task detail
- **Self-hosted Langfuse v3** — 6 Docker services (web, worker, PostgreSQL, ClickHouse, Redis, MinIO), auto-integrated with backend

### Backend endpoints added:
- `GET /api/dashboard`, `GET /api/allocate/scores`, `POST /api/allocate/reason`
- `POST /api/tasks/classify-skills`, `DELETE /api/tasks/:id`, `POST /api/tasks/:id/generate-subtasks`
- `GET /api/projects/:id/tasks`, `POST /api/projects/:id/generate-tasks`

### Design specs created:
- `docs/superpowers/specs/2026-05-22-ux-redesign-allocation-copilot.md`
- `docs/superpowers/specs/2026-05-22-project-detail-rich-task-management.md`
- `docs/superpowers/specs/2026-05-22-task-detail-subtask-management.md`

### Files removed:
- `TaskCreatePage.tsx`, `TaskFormNode.tsx`, `treeUtils.ts` + their tests — replaced by inline creation and Task Detail page

Pages updated:
- [[wiki/overview]] — complete rewrite with all 19 features, 12 Docker services, API endpoints
- [[wiki/index]] — added design specs section
