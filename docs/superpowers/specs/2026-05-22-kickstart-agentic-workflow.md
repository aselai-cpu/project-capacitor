# Kickstart: Agentic Project Setup Workflow

**Date:** 2026-05-22
**Status:** Approved

## Summary

A single-page agentic workflow that takes a project description and team members (existing + new with CVs), then autonomously enriches the project, generates tasks with estimations, extracts skills from CVs, and assigns developers with workload-balanced allocation. The user watches a live vertical pipeline as the agent works, then reviews a summary with task list and team workload breakdown.

## Motivation

Currently, setting up a project requires multiple manual steps across different pages: create project → enrich → generate tasks → upload CVs → assign developers. This workflow chains all existing LLM-powered features into a single fire-and-forget flow, giving users a quick way to bootstrap a fully staffed project from a short description.

## Architecture

### Orchestration

- **TypeScript with Vercel AI SDK** — no new runtime or framework
- Inline orchestrator function in the existing Express backend
- **SSE (Server-Sent Events)** for real-time progress streaming to the frontend
- **Langfuse tracing** — one parent span `agent:kickstart` containing child spans per step; each LLM call becomes a generation span within its step

### Pipeline Steps

```
Step 1: Create & Enrich Project
         |
    ┌────┴────┐
    ▼         ▼
Step 2:    Step 3:
Generate   Process Team
Tasks      (CV extraction)
    └────┬────┘
         ▼
Step 4: Assign & Balance
```

**Step 1 — Create & Enrich Project**
- Creates project in DB via `prisma.project.create()` with user-provided name and description
- Calls existing `enrichProject()` to generate full description, tech stack, architecture, domain, requirements, constraints
- Updates the project with enriched fields via `prisma.project.update()`
- Must complete before steps 2 and 3 (step 2 needs enriched project context)

**Step 2 — Generate Tasks** (parallel with step 3)
- Calls existing `generateTasks()` in 3 rounds to produce 10-15 tasks (the function generates 3-5 per call)
- **Hint strategy:** The orchestrator auto-generates a directional hint per round based on the enriched project context: round 1 uses `"core backend and infrastructure"`, round 2 uses `"frontend and user-facing features"`, round 3 uses `"testing, DevOps, and integrations"`. These generic categories ensure broad task coverage.
- Each round passes `existingTaskTitles` from prior rounds to avoid duplicates, and `availableSkillNames` from the DB skill table
- **Skill resolution:** `generateTasks()` returns `skillNames: string[]`. The orchestrator resolves these to `skillIds` by querying the Skill table. Missing skills are created via `prisma.skill.upsert()`. Note: `taskService.createTask()` has its own internal LLM skill classification for tasks with empty `skillIds` — since we pass pre-resolved IDs, this internal classification is harmlessly skipped.
- Tasks are created in DB via `taskService.createTask()` with `parentId: null` and `subtasks: []` (all root-level tasks under the project)
- Emits each task to the SSE stream as it's created

**Step 3 — Process Team Members** (parallel with step 2)
- For existing developers: loads their current skills from DB via `prisma.developer.findUnique({ include: { skills: true } })`
- For new members: creates developer via `prisma.developer.create()`, then processes their CV:
  - If a PDF file was uploaded (`cv_i`): parse text using `pdf-parse`, then call `extractSkillsFromCV()` with extracted text
  - If `cvText` was provided (pasted text): call `extractSkillsFromCV()` directly
  - If both file and `cvText` provided: file upload takes precedence
  - If neither: developer is created with no skills (will receive low-priority assignments)
- CV extraction runs in parallel across new members
- Emits each processed developer to the SSE stream

**Step 4 — Assign & Balance**
- Waits for both steps 2 and 3 to complete
- If total story points is 0 (all tasks have null/0 points), skips balance optimization and assigns round-robin by skill match only
- Calls new `assignTasksBalanced()` function (see below) — the prompt includes task IDs and developer IDs so the LLM returns valid UUIDs
- Writes assignments to DB via `prisma.task.update({ data: { developerId } })`
- Emits each assignment to the SSE stream

### Retry Logic

Each step retries up to 3 times on failure with exponential backoff. The SSE stream reports retry attempts:

```
event: step
data: {"step":"enrich","status":"retrying","attempt":2,"error":"LLM timeout"}
```

Only after 3 failures does it emit `event: error` and stop. Data written to DB before the failure persists — user can navigate to the project page for partial results.

## API Design

### Endpoint

```
POST /api/agent/kickstart
Content-Type: multipart/form-data
Response: text/event-stream (SSE)
```

### Request Payload

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Project name |
| `description` | string | Project description (free text) |
| `existingDeveloperIds` | JSON string (string[]) | IDs of existing developers to include |
| `newMembers` | JSON string ({name, cvText?}[]) | New team members to create |
| `cv_0`, `cv_1`, ... | File (PDF) | CV uploads for new members, matched by index into `newMembers` array. File takes precedence over `cvText` if both provided. |

### SSE Implementation Notes

This is an unusual pattern (POST multipart → SSE response). The route handler must:
- Use `multer` middleware to parse the multipart form data
- Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Call `res.flushHeaders()` before streaming events
- The orchestrator must wrap the entire pipeline in a `try/catch` and emit errors as SSE events — never let exceptions propagate to Express's global JSON error handler, which would crash the stream with "headers already sent"

### SSE Event Protocol

**Step lifecycle events:**
```
event: step
data: {"step":"enrich|generate-tasks|process-team|assign","status":"running|retrying|done|error",...}
```

**Granular progress events:**
```
event: task
data: {"title":"...","storyPoints":5,"skills":["DevOps","Docker"]}

event: member
data: {"name":"Alice","skills":["React","TypeScript"],"isNew":false}

event: assignment
data: {"task":"...","developer":"Bob","points":5,"reason":"..."}
```

**Completion:**
```
event: done
data: {"projectId":"...","summary":{"taskCount":12,"totalPoints":89,"memberCount":4,"balanceScore":0.96}}
```

**Error (after 3 retries):**
```
event: error
data: {"step":"generate-tasks","error":"LLM provider unavailable","partialProjectId":"..."}
```

## Balanced Assignment Algorithm

### Approach: LLM-Powered with Constraints

A single LLM call receives all tasks and developers and produces the full assignment. The LLM handles skill adjacency naturally ("JavaScript developer can do React work") without requiring a manual skill-similarity matrix.

### Prompt Structure

```
Given these tasks and developers, assign every task to a developer.

HARD CONSTRAINTS:
- Every task must be assigned
- Developer must have at least 1 matching skill (adjacent skills count)
- Do NOT assign tasks where there is zero skill relevance

OPTIMIZATION GOAL:
- Balance total story points as evenly as possible
- Target: ~{totalPoints / teamSize} points per person

TASKS:
- "Set up CI/CD" (id: uuid-1, 5 pts) — skills: DevOps, Docker
- "Design DB schema" (id: uuid-2, 8 pts) — skills: PostgreSQL
[each task includes its UUID so you can reference it in assignments]

DEVELOPERS:
- Alice (id: dev-uuid-1) — skills: React, TypeScript, Node.js (0 pts assigned)
- Bob (id: dev-uuid-2) — skills: DevOps, Docker (0 pts assigned)
[each developer includes their UUID]

Return assignments with reasoning.
```

### Output Schema (Zod)

```typescript
z.object({
  assignments: z.array(z.object({
    taskId: z.string(),
    developerId: z.string(),
    reason: z.string(),
  })),
})
```

### Post-LLM Validation

- Verify every task is assigned exactly once
- Verify no developer got zero tasks (unless team size > task count)
- Calculate balance score: `1 - (maxDeviation / averagePoints)` (guard: if averagePoints is 0, score is 1.0)
- If balance score < 70%, retry with explicit feedback about which developer is over/underloaded (counts toward the 3-retry limit)

## Frontend Design

### Route

`/kickstart` — new page, added to NavBar

### Three Page States

**State 1: Input Form**
- Project name text input
- Project description textarea
- Existing team: chip-select from current developers (toggle on/off)
- New members: repeatable row with name input + CV upload (PDF) or paste text
- "Kickstart Project" submit button

**State 2: Live Progress (Pipeline View)**
- Project name at top
- Vertical step list with status indicators (done ✓, running spinner, pending ○)
- Steps 2 and 3 shown side by side in parallel containers
- Tasks and team members appear in real-time as SSE events arrive
- Elapsed time per completed step

**State 3: Summary**
- Success banner with totals (tasks, points, members, elapsed time)
- Two-column layout:
  - Left: generated task list with story points
  - Right: team workload — bar chart per developer showing assigned points and task count, plus balance score
- "View Project →" button linking to `/projects/:id`

## File Structure

### New Files

**Backend:**
- `backend/src/routes/agent.ts` — SSE endpoint for kickstart
- `backend/src/services/agentService.ts` — Pipeline orchestrator with retry logic and SSE event emission

**Frontend:**
- `frontend/src/pages/KickstartPage.tsx` — 3-state page container
- `frontend/src/components/kickstart/KickstartForm.tsx` — Input form
- `frontend/src/components/kickstart/KickstartProgress.tsx` — Pipeline progress view
- `frontend/src/components/kickstart/KickstartSummary.tsx` — Results summary

### Modified Files

- `backend/src/services/llmService.ts` — Add `assignTasksBalanced()` function
- `backend/src/index.ts` — Register `/api/agent` router
- `frontend/src/App.tsx` — Add `/kickstart` route
- `frontend/src/components/NavBar.tsx` — Add "Kickstart" nav link

### Reused (No Changes)

- `llmService.enrichProject()` — Step 1
- `llmService.generateTasks()` — Step 2
- `llmService.extractSkillsFromCV()` — Step 3
- `taskService.createTask()` — DB persistence
- Langfuse telemetry wiring via `experimental_telemetry`

### Direct Prisma Usage in Orchestrator

The orchestrator (`agentService.ts`) uses Prisma directly for operations that don't have a dedicated service:
- `prisma.project.create()` / `prisma.project.update()` — project creation and enrichment persistence
- `prisma.developer.create()` — new team member creation
- `prisma.developer.findUnique()` — loading existing developer skills
- `prisma.skill.upsert()` — creating missing skills during task skill resolution
- `prisma.skill.findMany()` — loading available skill names for task generation
- `prisma.task.update()` — writing developer assignments

## Langfuse Trace Structure

```
trace: agent:kickstart
├── span: step:enrich
│   └── generation: enrichProject LLM call
├── span: step:generate-tasks
│   ├── generation: generateTasks round 1
│   ├── generation: generateTasks round 2
│   └── generation: generateTasks round 3
├── span: step:process-team
│   ├── generation: extractSkillsFromCV (Eve)
│   └── generation: extractSkillsFromCV (Frank)
└── span: step:assign
    └── generation: assignTasksBalanced LLM call
```

## Out of Scope

- Editing/tweaking results inline on the kickstart page (use existing project/task pages)
- Resuming a failed workflow from where it stopped
- Multiple workflow runs simultaneously
- Subtask generation (can be done later from task detail page)
