---
type: note
title: Final Pre-Implementation Decisions
created: 2026-05-21
updated: 2026-05-21
---
# Final Pre-Implementation Decisions

Synthesized from [[wiki/notes/spec-ambiguities]], [[wiki/notes/ambiguity-solutions]], and [[wiki/notes/devils-advocate-blind-spots]]. These are the definitive answers for all open questions. Optimized for shipping within the time constraint.

**Guiding principle:** Ship a clean, working app. Every decision below prioritizes "does it work and satisfy the spec" over "is it architecturally impressive."

---

## 1. Status: Three values, free transitions, one guard

`TODO`, `IN_PROGRESS`, `DONE` enum. **All transitions allowed.** Only one guard: entering DONE requires all subtasks to be DONE.

- Dropdown shows all 3 options always — no conditional filtering
- No auto-regression when subtask is added to DONE parent
- The cascade guard is the only business rule enforced on status changes

```prisma
enum TaskStatus {
  TODO          @map("To-do")
  IN_PROGRESS   @map("In Progress")
  DONE          @map("Done")
}
```

---

## 2. Task List: Flat table with indent, not tree-table

Single flat list showing **all tasks** (root + subtasks) with CSS indent by depth. No expand/collapse. No lazy loading. No chevrons.

- Each row has `padding-left: ${depth * 24}px` for visual hierarchy
- Optionally prefix subtask titles with "↳"
- Status and assignee dropdowns on every row (root and subtask alike)
- API returns flat array — frontend maps and indents

```
GET /api/tasks → flat array, each task has parentId + depth field
Frontend: tasks.map(task => <Row indent={task.depth} ... />)
```

**Polish (if time permits):** Upgrade to collapsible tree-table.

---

## 3. Subtask creation: Create page only, with "Add Subtask" link from List

Subtasks created **only on the Task Creation page** via recursive `<TaskFormNode />`. Follows the spec literally (Part 4.3).

Post-creation subtask addition: the List page has an "Add Subtask" link per row that navigates to the Create page with `parentId` pre-populated in the URL.

```
List page row: [Title] [Skills] [Status ▾] [Assignee ▾] [+ Add Subtask]
"+ Add Subtask" → navigates to /tasks/new?parentId=uuid
Create page: detects parentId from URL, creates single subtask under that parent
```

Same Create page component, same POST endpoint, just pre-filled context. Zero new components needed.

---

## 4. LLM: Synchronous, parallelized, fail-open

Synchronous with `Promise.allSettled()` parallelization. Fail-open — task saves with empty skills on LLM failure.

### For single task creation (with parentId or no subtasks)
One LLM call, inline. ~1-2 seconds.

### For tree creation (recursive subtasks on Create page)
Collect all skill-less nodes → classify in parallel → apply results → DB write.

```typescript
const needsSkills = collectNodesWithoutSkills(tree);
const results = await Promise.allSettled(
  needsSkills.map(node => classifySkills(node.title))
);
results.forEach((result, i) => {
  needsSkills[i].skillIds = result.status === 'fulfilled' ? result.value : [];
});
```

### Timeout
5 seconds for entire batch via `Promise.race()` with timer. Not per-call.

### On failure
Save task with empty skills. No `skillSource` enum — keep schema simple. Empty skills cell is self-explanatory.

### Provider
- Vercel AI SDK (`ai`) with 4 provider adapters — auto-detects from API key
- Supported: Google Gemini (default), OpenAI, Anthropic, Moonshot Kimi
- `generateObject()` with Zod schema for type-safe structured output
- Set one API key in `.env` — app auto-detects which provider to use
- `LLM_PROVIDER` and `LLM_MODEL` env vars for explicit overrides

---

## 5. API: Simple REST, flat list + individual detail

| Endpoint | Returns | Notes |
|----------|---------|-------|
| `GET /api/tasks` | All tasks flat array with `parentId`, `depth`, skills, assignee | Frontend sorts/indents |
| `GET /api/tasks/:id` | Single task with recursive `subtasks[]` | For future tree-table upgrade |
| `POST /api/tasks` | Create task | Optional `parentId` for subtask; optional `subtasks[]` for tree; LLM enrichment inline |
| `PATCH /api/tasks/:id` | Update status and/or developerId | Cascade guard on DONE; skill superset guard on assignment |
| `GET /api/developers` | All developers with skills | For assignee dropdown |
| `GET /api/developers/:id` | Single developer with skills | Satisfies "A Developer can be read" |
| `GET /api/skills` | All skills | For skill selector on Create page |

No pagination. No `depth` query param. No `subtaskCount`. Minimal API surface.

---

## 6. ORM: Prisma with implicit many-to-many

Prisma implicit M:N for Developer↔Skill and Task↔Skill. Clean queries, zero join table boilerplate.

```prisma
model Developer {
  id     String  @id @default(uuid())
  name   String
  skills Skill[]
  tasks  Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("developers")
}

model Skill {
  id         String      @id @default(uuid())
  name       String      @unique
  developers Developer[]
  tasks      Task[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
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
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@map("tasks")
}
```

Migration to explicit join tables takes 10 minutes if proficiency metadata is ever needed. Note in README under "Future Improvements."

---

## 7. Frontend: React + plain useState, no state library

- React + TypeScript with `useState` and `useEffect`
- No Redux, Zustand, or Context for global state
- `fetch()` in `useEffect` on each page, local state for forms
- Recursive `<TaskFormNode />` uses `updateNodeInTree` pure function
- React Router: 2 routes (`/tasks` list, `/tasks/new` create)
- Styling: Tailwind CSS (fast to implement, clean result) or plain CSS modules

---

## 8. Backend: Express + TypeScript

Express is the pragmatic, zero-controversy choice. Most recognizable Node.js framework. Evaluators expect it.

Structure:
```
backend/
├── src/
│   ├── index.ts              # Express app setup, routes
│   ├── routes/
│   │   ├── tasks.ts          # Task CRUD routes
│   │   ├── developers.ts     # Developer read routes
│   │   └── skills.ts         # Skill read routes
│   ├── services/
│   │   ├── taskService.ts    # Business logic (guards, LLM enrichment)
│   │   └── llmService.ts     # Vercel AI SDK integration
│   └── lib/
│       └── prisma.ts         # Prisma client singleton
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 9. Docker: Simple single-stage, no optimization

Simple Dockerfiles. Multi-stage is an optimization that doesn't matter for a demo.

```dockerfile
# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/index.js"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: capacitor
    ports: ["5432:5432"]
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
```

**Polish (if time permits):** Multi-stage builds, Nginx for frontend.

---

## Implementation Order

| Priority | Part | Estimated Effort | Description |
|----------|------|-----------------|-------------|
| 1 | Part 1 | 1 hour | Prisma schema + seed + docker-compose with PostgreSQL |
| 2 | Part 2 | 2-3 hours | Express API — all endpoints with guards |
| 3 | Part 3 | 2-3 hours | React SPA — flat task list + create form (no subtasks yet) |
| 4 | Part 4 | 2-3 hours | Subtask schema change + cascade guard + recursive create form |
| 5 | Part 5 | 1-2 hours | Vercel AI SDK + LLM service + parallel enrichment |
| 6 | Part 6 | 1 hour | Dockerfiles + docker-compose (already drafted above) |
| 7 | Part 7 | 1 hour | README (pull from wiki decisions + ambiguity solutions) |
| **Total** | | **~10-14 hours** | |

Parts 1-6 are must-ship. Polish (tree-table, multi-provider, multi-stage Docker) is if-time-permits.
