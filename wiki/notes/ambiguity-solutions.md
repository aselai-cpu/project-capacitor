---
type: note
title: Ambiguity Solutions — Architectural Decisions for Spec Gaps
created: 2026-05-21
updated: 2026-05-21
---
# Ambiguity Solutions — Architectural Decisions for Spec Gaps

Concrete solutions for the 5 ambiguities identified in [[wiki/notes/spec-ambiguities]]. Each solution is grounded in UX heuristics (Nielsen's), DDD principles, and pragmatic system architecture. These should be documented in the README under "Design Assumptions."

## 1. Status Values — Three-State FSM with Guard Rails

**Solution:** `TaskStatus` enum with `TODO`, `IN_PROGRESS`, `DONE`.

### State Machine

```
TODO ──→ IN_PROGRESS ──→ DONE
  ↑           │              │
  └───────────┘              │
  ↑                          │
  └──────────────────────────┘
```

### Transition Rules

| Transition | Allowed | Guard |
|-----------|---------|-------|
| TODO → IN_PROGRESS | Yes | None |
| IN_PROGRESS → DONE | Yes | All subtasks must be Done |
| DONE → TODO | Yes | Reopens the task (common in agile) |
| TODO → DONE | **No** | Must pass through IN_PROGRESS — prevents accidental completion |
| IN_PROGRESS → TODO | Yes | Developer unassigns or deprioritizes |

### Rationale

- **Why 3 states, not 2:** Nielsen's Visibility of System Status — users need to distinguish "not started" from "being worked on." Binary To-do/Done hides the most critical information in a task assignment system: what's actively being worked on. The DDD aggregate integrity also benefits — the cascade rule becomes meaningful with 3 states.
- **Why allow DONE → TODO:** Real work gets reopened. Blocking this creates dead-ends forcing workarounds (delete + recreate). The spec's "etc." implies flexibility.
- **Adding subtask to DONE parent:** Do NOT auto-regress parent status. Show a warning toast: "This task is marked Done. The new subtask will need to be completed before it can be marked Done again." Follows Nielsen's Error Prevention — inform, don't silently mutate.

### Implementation

- Backend: `TaskStatus` enum in Prisma schema (`TODO`, `IN_PROGRESS`, `DONE`)
- Backend: Transition validation in service layer — reject invalid transitions with 422
- Frontend: Status dropdown shows only valid next states based on current status

**Affects:** [[wiki/entities/task|Task entity]], [[wiki/requirements/part1-database|Part 1]], [[wiki/requirements/part2-backend-api|Part 2]]

---

## 2. Task List Page — Expandable Tree-Table with Lazy Loading

**Solution:** Root tasks as primary rows with chevron toggle (▶/▼) to expand/collapse subtasks inline with visual indentation.

### Visual Design

```
▼  "Build user profile system"     [Frontend, Backend]  In Progress  Carol ▾
    ▶  "Design profile layout"      [Frontend]           To-do        Alice ▾
    ▼  "Build profile API"          [Backend]            In Progress  Bob ▾
        "Set up S3 bucket"          [Backend]            To-do        ─ ▾
   "Implement audit logging"        [Backend]            To-do        ─ ▾
```

### Design Principles

- **Progressive disclosure** (Nielsen's Aesthetic & Minimalist Design) — show root tasks by default, let users drill into subtrees on demand
- **Expand state persists in URL** — query params (`?expanded=id1,id2`) so page refresh preserves state. Nielsen's User Control & Freedom
- **Indent depth capped at visual level 4** — beyond that, indent stays constant but a "depth: 5" badge appears. Prevents the table from becoming a skinny right-aligned column

### The "..." column in wireframe

Ignore it — likely a wireframe artifact indicating "more columns possible." Don't add columns the spec doesn't define (YAGNI).

### Data Loading Strategy

- `GET /api/tasks` returns root tasks with `subtaskCount` (no nested objects) — fast initial load
- Expanding a row triggers `GET /api/tasks/:id` to load that subtree
- Subtask data cached in frontend state to avoid re-fetching on collapse/expand

**Affects:** [[wiki/requirements/part3-frontend|Part 3]], [[wiki/requirements/part4-subtasks|Part 4]], [[wiki/requirements/part2-backend-api|Part 2]]

---

## 3. Subtask Creation — Create-Time AND Post-Creation via Inline Action

**Solution:** Two creation flows using the same underlying component and API.

### Flow A — Create Page (spec requirement, Part 4.3)

The recursive `<TaskFormNode />` component from [[wiki/notes/gemini-design-discussion]]. Full tree submitted atomically in one POST. This is the spec's explicit requirement.

### Flow B — Task List Page (necessary extension)

Each row in the tree-table gets a **"+" icon button**. Clicking it opens an inline form row directly below the parent — same fields as the create form but scoped to one subtask. On save, fires `POST /api/tasks` with a `parentId` field.

### Why this is architecturally necessary

- Work decomposition is iterative — you discover subtasks as you work, not only at planning time
- Without post-creation subtask addition, the system is impractical for real use
- The spec says "You can make assumptions on any information not specified" — this is the assumption
- The API already supports it — a task with `parentId` is a subtask. No new endpoint needed, just an optional field on the existing POST

### Why NOT a separate "Edit Task" page

The spec defines two pages (List + Create). Adding a third is a bigger scope extension than adding an inline action. The inline approach stays within the spec's page boundary while adding the missing capability.

### API Impact

```
POST /api/tasks
{
  "title": "New subtask",
  "skillIds": [],
  "parentId": "existing-task-uuid"  // optional — if present, creates as subtask
}
```

No new endpoints. The existing POST handles both root tasks and subtask additions.

**Affects:** [[wiki/requirements/part3-frontend|Part 3]], [[wiki/requirements/part4-subtasks|Part 4]], [[wiki/requirements/part2-backend-api|Part 2]]

---

## 4. LLM Skill Identification — Synchronous with Graceful Degradation

**Solution:** Synchronous inline classification with a 3-tier fallback strategy.

### Flow

```
User submits task without skills
         │
         ▼
    ┌─────────────┐
    │ LLM classify │ ← timeout: 5 seconds
    │ (Vercel AI   │
    │  SDK)        │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │  Success?   │
    ├─── Yes ────→ Save task with LLM-predicted skills
    │               skillSource = "llm"
    │
    ├─── Timeout ─→ Save task with skills = []
    │               skillSource = "pending"
    │
    └─── Error ──→ Save task with skills = []
                    skillSource = "failed"
```

### Data Model Addition

Add `skillSource` field to [[wiki/entities/task|Task]] entity:

```typescript
enum SkillSource {
  USER     // skills explicitly selected by user
  LLM      // skills auto-classified by LLM
  PENDING  // LLM timed out, awaiting manual classification
  FAILED   // LLM errored, needs manual classification
}
```

### Why synchronous

- The user is creating a task — already in a "waiting" mental model. A 1-2 second LLM call (Gemini Flash / GPT-4o-mini) fits that expectation.
- Async introduces enormous complexity: WebSockets or polling, UI states for "skills pending", race conditions on navigation. Not worth it for this scope.

### Why graceful degradation

- Nielsen's Error Recovery — never let an LLM failure prevent core functionality. A task without skills is still valid. The skill guard on assignment simply rejects until skills are populated.
- The `skillSource` field enables frontend to show a subtle indicator: orange dot on tasks with pending/failed classification, inviting manual skill selection.

### Frontend UX

- Save button shows a micro-spinner ("Saving...") during LLM wait. No separate "classifying skills" state — users don't need to know about the LLM.
- Nielsen's Match Between System and Real World — users think "saving a task," not "running an AI classifier."

**Affects:** [[wiki/requirements/part5-llm-skill-id|Part 5]], [[wiki/requirements/part2-backend-api|Part 2]], [[wiki/decisions/004-vercel-ai-sdk|ADR-004]], [[wiki/entities/task|Task entity]]

---

## 5. API Granularity — RESTful Resources with Depth Control

**Solution:** Standard REST resource endpoints with a `depth` query parameter for tree control.

### Endpoint Design

| Endpoint | Response | Use Case |
|----------|----------|----------|
| `GET /api/tasks` | Root tasks with `subtaskCount` (no nested objects) | Task List initial load |
| `GET /api/tasks/:id` | Single task with full recursive subtask tree | Expand action / detail |
| `GET /api/tasks/:id?depth=1` | Single task with immediate children only | Partial expand |
| `POST /api/tasks` | Create task (with optional `parentId` and recursive `subtasks[]`) | Create page + inline subtask |
| `PATCH /api/tasks/:id` | Update status or assignee (with guards) | List page dropdowns |
| `GET /api/developers` | All developers with skills array | Assignee dropdown |
| `GET /api/developers/:id` | Single developer with skills + assigned task IDs | Developer detail |
| `GET /api/skills` | All skills | Skill selector on Create page |

### Why `subtaskCount` on list endpoint

- **Performance** — list is called on every page load. Full recursive trees make response unbounded. `subtaskCount: 3` tells UI to show a chevron; tree loads on expand via `:id`
- **Separation of concerns** — list answers "what tasks exist?" while detail answers "what does this task look like?"

### Developer response shape

```json
{
  "id": "uuid",
  "name": "Carol",
  "skills": [{ "id": "uuid", "name": "Frontend" }, { "id": "uuid", "name": "Backend" }],
  "assignedTaskIds": ["task-uuid-1", "task-uuid-2"]
}
```

Assigned tasks are IDs only (not full objects) to avoid circular references. Frontend fetches task details separately if needed.

### Why include GET /api/developers/:id

The spec says "A Developer and all their relevant properties can be read" — singular "A Developer" implies a single-resource endpoint. The list endpoint alone doesn't satisfy this.

### Pagination

Not implemented for MVP (seed data is 4 developers, tasks will be <100). Note in README that pagination (cursor-based) would be added for production scale.

**Affects:** [[wiki/requirements/part2-backend-api|Part 2]], [[wiki/requirements/part3-frontend|Part 3]]
