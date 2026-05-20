# Task Assignment Application — Implementation Spec

**Date:** 2026-05-21
**Status:** Proposed

## Summary

Full-stack Task Assignment application for the xDigital AI Products Team at HTX. Developers are assigned to tasks based on skill matching, tasks support recursive subtasks with status cascade rules, and an LLM auto-classifies required skills from task titles.

## Tech Stack

| Layer | Technology | ADR |
|-------|-----------|-----|
| Database | PostgreSQL 15 + Prisma ORM (implicit M:N) | ADR-001 |
| Backend | Express.js + TypeScript + Zod validation | ADR-006 |
| Frontend | Vite + React 19 + React Router v7 + Tailwind CSS | ADR-005 |
| LLM | Vercel AI SDK (Google/OpenAI/Anthropic/Moonshot — auto-detected) | ADR-004 |
| Infrastructure | Docker + docker-compose (single-stage builds) | ADR-003 |
| API Design | REST, recursive JSON payload for tree creation | ADR-002 |

## Domain Model

Three bounded contexts (see `docs/concepts/domain-driven-design.md`):

- **Capability Context:** Developer + Skill entities (static, seeded)
- **Execution Context:** Task entity with recursive subtask tree (Aggregate Root pattern)
- **Cognitive Context:** LLM skill classification bridge (transient, no persistent state)

### Entities

**Developer:** `id` (UUID), `name` (string), `skills` (Skill[]), `tasks` (Task[])

**Skill:** `id` (UUID), `name` (string, unique — "Frontend" or "Backend")

**Task:** `id` (UUID), `title` (string), `status` (TODO | IN_PROGRESS | DONE), `parentId` (UUID, nullable), `developerId` (UUID, nullable), `skills` (Skill[]), `subtasks` (Task[])

### Relationships

- Developer ↔ Skill: many-to-many (implicit join table)
- Task ↔ Skill: many-to-many (implicit join table)
- Task → Developer: many-to-one (optional assignee)
- Task → Task: self-referencing one-to-many (parent → subtasks, unbounded depth)

### Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum TaskStatus {
  TODO        @map("To-do")
  IN_PROGRESS @map("In Progress")
  DONE        @map("Done")
}

model Developer {
  id        String   @id @default(uuid())
  name      String
  skills    Skill[]
  tasks     Task[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("developers")
}

model Skill {
  id         String      @id @default(uuid())
  name       String      @unique
  developers Developer[]
  tasks      Task[]
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")
  @@map("skills")
}

model Task {
  id          String     @id @default(uuid())
  title       String
  status      TaskStatus @default(TODO)
  parentId    String?    @map("parent_id")
  parent      Task?      @relation("TaskHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  subtasks    Task[]     @relation("TaskHierarchy")
  developerId String?    @map("developer_id")
  developer   Developer? @relation(fields: [developerId], references: [id], onDelete: SetNull)
  skills      Skill[]
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")
  @@map("tasks")
}
```

### Seed Data

| Developer | Skills |
|-----------|--------|
| Alice | Frontend |
| Bob | Backend |
| Carol | Frontend, Backend |
| Dave | Backend |

Skills seeded: "Frontend", "Backend"

## Domain Invariants

**Invariant A — Capability Superset Rule:**
A Task can only be assigned to a Developer whose skills are a superset of the Task's required skills. Checked on PATCH (assignment). Returns 422 on violation.

**Invariant B — Hierarchical Status Cascade:**
A Task can only transition to DONE if all its subtasks have status DONE. Checked on PATCH (status update). Returns 400 on violation. All other status transitions are unrestricted.

## API Specification

### Tasks

**`GET /api/tasks`** — List all tasks (flat array)

Response: Array of tasks, each with `parentId`, computed `depth` field, populated `skills` and `developer`.

```json
[
  {
    "id": "uuid",
    "title": "Build responsive homepage",
    "status": "TODO",
    "parentId": null,
    "depth": 0,
    "skills": [{ "id": "uuid", "name": "Frontend" }],
    "developer": { "id": "uuid", "name": "Alice" },
    "createdAt": "2026-05-21T00:00:00Z"
  },
  {
    "id": "uuid",
    "title": "Design mobile layout",
    "status": "TODO",
    "parentId": "parent-uuid",
    "depth": 1,
    "skills": [{ "id": "uuid", "name": "Frontend" }],
    "developer": null,
    "createdAt": "2026-05-21T00:00:00Z"
  }
]
```

Ordering: depth-first pre-order traversal — parent before its children, siblings ordered by `createdAt`.

**Computing `depth`:** Done in-memory after a single `prisma.task.findMany()`. Build a parent→children map from `parentId`, then walk the tree recursively starting from root nodes (`parentId === null`), assigning `depth = 0` for roots and `depth = parent.depth + 1` for children. Dataset is small (<100 tasks) so in-memory traversal is efficient.

```typescript
function computeFlatListWithDepth(tasks: Task[]): (Task & { depth: number })[] {
  const childrenMap = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(task);
  }

  const result: (Task & { depth: number })[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}
```

---

**`GET /api/tasks/:id`** — Get single task with recursive subtask tree

Response: Single task with nested `subtasks[]` array (recursive).

```json
{
  "id": "uuid",
  "title": "Build responsive homepage",
  "status": "TODO",
  "parentId": null,
  "skills": [{ "id": "uuid", "name": "Frontend" }],
  "developer": { "id": "uuid", "name": "Alice" },
  "createdAt": "2026-05-21T00:00:00Z",
  "subtasks": [
    {
      "id": "uuid",
      "title": "Design mobile layout",
      "status": "TODO",
      "parentId": "parent-uuid",
      "skills": [...],
      "developer": null,
      "createdAt": "2026-05-21T00:00:00Z",
      "subtasks": []
    }
  ]
}
```

---

**`POST /api/tasks`** — Create task (single or tree)

Request body:
```json
{
  "title": "Build user profile system",
  "skillIds": [],
  "parentId": null,
  "subtasks": [
    {
      "title": "Design profile layout",
      "skillIds": ["frontend-uuid"],
      "subtasks": []
    },
    {
      "title": "Build profile API",
      "skillIds": [],
      "subtasks": [
        { "title": "Set up storage", "skillIds": [], "subtasks": [] }
      ]
    }
  ]
}
```

Behavior:
1. Validate request body with Zod schema (recursive)
2. Collect all nodes with empty `skillIds` → classify via LLM in parallel (`Promise.allSettled()`, 5s batch timeout)
3. On LLM failure: save with empty skills (fail-open)
4. Transform to Prisma nested create → commit atomically via `prisma.$transaction()`
5. Return created task tree (same shape as GET /:id)

**Recursive tree-to-Prisma transform:**

```typescript
function toPrismaCreate(node: CreateTaskInput): Prisma.TaskCreateInput {
  return {
    title: node.title,
    skills: {
      connect: node.skillIds.map(id => ({ id })),
    },
    subtasks: node.subtasks.length > 0
      ? { create: node.subtasks.map(child => toPrismaCreate(child)) }
      : undefined,
  };
}

// Usage in taskService.create():
const prismaData = toPrismaCreate(enrichedPayload);
const created = await prisma.$transaction(async (tx) => {
  return tx.task.create({
    data: prismaData,
    include: {
      skills: true,
      developer: true,
      subtasks: { include: { skills: true, developer: true } },
    },
  });
});
```

Note: Prisma's nested `create` auto-wires `parentId` for child tasks.

Zod schema:
```typescript
const createTaskSchema: z.ZodType<CreateTaskInput> = z.object({
  title: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional().default([]),
  parentId: z.string().uuid().nullable().optional().default(null),
  subtasks: z.lazy(() => z.array(createTaskSchema)).optional().default([]),
});
```

---

**`PATCH /api/tasks/:id`** — Update task status or assignee

Request body (partial):
```json
{ "status": "DONE" }
// or
{ "developerId": "developer-uuid" }
// or both
```

Guards:
- If `status` is `DONE`: check Invariant B (all subtasks must be DONE). Return 400 if violated.
- If `developerId` is set: check Invariant A (developer skills ⊇ task required skills). Return 422 if violated.
- If `developerId` is `null`: unassign (always allowed).

---

### Developers

**`GET /api/developers`** — List all developers with skills

```json
[
  { "id": "uuid", "name": "Alice", "skills": [{ "id": "uuid", "name": "Frontend" }] },
  { "id": "uuid", "name": "Carol", "skills": [{ "id": "uuid", "name": "Frontend" }, { "id": "uuid", "name": "Backend" }] }
]
```

**`GET /api/developers/:id`** — Get single developer with skills

Same shape as list item.

---

### Skills

**`GET /api/skills`** — List all skills

```json
[
  { "id": "uuid", "name": "Frontend" },
  { "id": "uuid", "name": "Backend" }
]
```

## Frontend Specification

### Pages

**Task List Page** (`/tasks`)

- Flat table showing all tasks (root + subtasks) with CSS indent by depth
- Columns: Title (indented), Skills (badges), Status (dropdown), Assignee (dropdown), Actions ("+ Add Subtask" link)
- Status dropdown: shows TODO, IN_PROGRESS, DONE — on change, calls PATCH
- Assignee dropdown: shows developers filtered by task's required skills — on change, calls PATCH
- "Add Subtask" link navigates to `/tasks/new?parentId=<id>`
- Data fetched via `GET /api/tasks` on mount; developers via `GET /api/developers`

**Task Creation Page** (`/tasks/new`)

- Form with title input and skill selection (checkboxes/toggle buttons for Frontend/Backend)
- Recursive subtask creation: "Add Subtask" button spawns nested `<TaskFormNode />` components
- Each subtask has same fields: title + skill selection + its own "Add Subtask" button
- If URL has `?parentId=<id>`: single subtask creation mode (no recursive nesting, just one form)
- Save button submits entire tree to `POST /api/tasks`
- On success: navigate to `/tasks`

### Components

```
frontend/src/
├── App.tsx                    # React Router setup (2 routes)
├── pages/
│   ├── TaskListPage.tsx       # Flat table with dropdowns
│   └── TaskCreatePage.tsx     # Recursive form orchestrator
├── components/
│   ├── TaskRow.tsx            # Single table row (indent, dropdowns)
│   ├── TaskFormNode.tsx       # Recursive form node (title, skills, add subtask)
│   ├── StatusDropdown.tsx     # Status selector (TODO/IN_PROGRESS/DONE)
│   └── AssigneeDropdown.tsx   # Developer selector (filtered by skills)
├── lib/
│   ├── api.ts                 # fetch() wrappers for all endpoints
│   └── types.ts               # TypeScript interfaces matching API shapes
└── utils/
    └── treeUtils.ts           # updateNodeInTree(), collectNodesWithoutSkills()
```

### State Management

- `useState` + `useEffect` per page — no global state library
- TaskListPage: `tasks[]` state, `developers[]` state, fetched on mount
- TaskCreatePage: `rootTask: TaskFormState` state (recursive tree), managed via `updateNodeInTree()` pure function
- `TaskFormState` interface:
  ```typescript
  interface TaskFormState {
    id: string;          // client-side UUID (crypto.randomUUID())
    title: string;
    skillIds: string[];
    subtasks: TaskFormState[];
  }
  ```

## Backend Structure

```
backend/src/
├── index.ts                   # Express app, CORS, JSON parser, route mounting
├── routes/
│   ├── tasks.ts               # GET /api/tasks, GET /:id, POST, PATCH /:id
│   ├── developers.ts          # GET /api/developers, GET /:id
│   └── skills.ts              # GET /api/skills
├── services/
│   ├── taskService.ts         # Business logic: create tree, validate assignment,
│   │                          #   validate status cascade, compute depth
│   └── llmService.ts          # classifySkills(title): string[]
│                              #   Uses generateObject() + Zod schema
├── middleware/
│   └── validate.ts            # Zod validation middleware
└── lib/
    └── prisma.ts              # PrismaClient singleton
```

### LLM Service

```typescript
// llmService.ts
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const skillSchema = z.object({
  skills: z.array(z.enum(['Frontend', 'Backend']))
});

export async function classifySkills(title: string): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: skillSchema,
      prompt: `You are a task classifier. Given this software task description, identify which technical skills it requires. Only classify as "Frontend" (UI, CSS, components, pages) or "Backend" (APIs, databases, servers, security) or both.\n\nTask: "${title}"`,
    });
    return object.skills;
  } catch {
    return []; // fail-open
  }
}
```

### Parallel LLM enrichment for tree creation

```typescript
// taskService.ts
async function enrichTreeWithSkills(node: CreateTaskInput, skillMap: Map<string, string>) {
  const needsSkills: CreateTaskInput[] = [];
  collectNodesWithoutSkills(node, needsSkills);

  if (needsSkills.length === 0) return;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LLM timeout')), 5000)
  );

  try {
    const results = await Promise.race([
      Promise.allSettled(needsSkills.map(n => classifySkills(n.title))),
      timeout,
    ]);

    (results as PromiseSettledResult<string[]>[]).forEach((result, i) => {
      if (result.status === 'fulfilled') {
        needsSkills[i].skillIds = result.value
          .map(name => skillMap.get(name))
          .filter(Boolean) as string[];
      }
    });
  } catch {
    // Timeout — leave skills empty, fail-open
  }
}
```

## Docker Configuration

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: capacitor
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d capacitor"]
      interval: 5s
      retries: 5

  backend:
    build: ./backend
    ports: ["5000:5000"]
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/capacitor
      GOOGLE_GENERATIVE_AI_API_KEY: ${GOOGLE_GENERATIVE_AI_API_KEY}
    depends_on:
      db: { condition: service_healthy }

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

volumes:
  pgdata:
```

### Frontend-Backend Networking

The SPA runs in the browser and makes `fetch()` calls to the backend API. In Docker, the browser cannot reach `http://backend:5000` (that's an internal Docker network hostname). Two configurations are needed:

**Backend CORS:** Allow requests from the frontend origin.
```typescript
// backend/src/index.ts
import cors from 'cors';
app.use(cors({ origin: 'http://localhost:3000' }));
```

**Frontend API base URL:** Hardcoded to `http://localhost:5000` (the backend's published port).
```typescript
// frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const fetchTasks = () => fetch(`${API_BASE}/api/tasks`).then(r => r.json());
```

**Why not a reverse proxy:** A production setup would use Nginx to proxy `/api` requests to the backend (avoiding CORS entirely). For the take-home MVP, direct CORS is simpler and avoids Nginx configuration complexity. Note in README as a production improvement.

### Startup sequence

1. `db` starts, healthcheck confirms `pg_isready`
2. `backend` starts, runs `prisma db push` (schema sync) → `prisma db seed` (seed data) → `node dist/index.js`
3. `frontend` starts, serves static SPA on port 3000

### Environment variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | backend | Yes | PostgreSQL connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | backend | Yes | Gemini API key for skill classification |
| `POSTGRES_USER` | db | Yes | Database user |
| `POSTGRES_PASSWORD` | db | Yes | Database password |
| `POSTGRES_DB` | db | Yes | Database name |

## Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid request body (Zod) | 400 | `{ "error": "Validation error", "details": {...} }` |
| Task not found | 404 | `{ "error": "Task not found" }` |
| Developer not found | 404 | `{ "error": "Developer not found" }` |
| Skill mismatch on assignment (Invariant A) | 422 | `{ "error": "Developer lacks required skills", "required": [...], "developer_skills": [...] }` |
| Subtasks not done (Invariant B) | 400 | `{ "error": "Cannot mark as done: subtasks not completed", "pending_subtasks": [...] }` |
| LLM failure | N/A | Fail-open — task created with empty skills |
| Server error | 500 | `{ "error": "Internal server error" }` |

## Design Assumptions

These are documented assumptions for ambiguities in the original spec (see `wiki/notes/spec-ambiguities.md`):

1. **Status values:** TODO, IN_PROGRESS, DONE — all transitions allowed, only DONE entry guarded by cascade rule
2. **Task List display:** Flat table with all tasks (root + subtasks), indented by depth
3. **Subtask creation:** Create page only (per spec Part 4.3), with "Add Subtask" navigation link from List page
4. **LLM timing:** Synchronous with 5s batch timeout, parallelized via Promise.allSettled(), fail-open
5. **API granularity:** Both list (flat) and detail (recursive tree) endpoints for tasks

## Implementation Order

| Priority | Part | Effort | Deliverable |
|----------|------|--------|-------------|
| 1 | Database | 1h | Prisma schema, seed script, docker-compose with PostgreSQL |
| 2 | Backend API | 2-3h | All 7 endpoints with Invariant A + B guards |
| 3 | Frontend (basic) | 2-3h | Task List (flat table, dropdowns) + Task Create (simple form, no subtasks) |
| 4 | Subtask feature | 2-3h | Self-ref schema, cascade guard, recursive create form, depth indent |
| 5 | LLM integration | 1-2h | LLM service, parallel enrichment, Zod structured output |
| 6 | Containerization | 1h | Dockerfiles, docker-compose, startup sequence |
| 7 | Documentation | 1h | README with setup, design, API docs, library justification |
| **Total** | | **~10-14h** | |
