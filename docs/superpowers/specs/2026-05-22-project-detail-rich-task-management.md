# Project Detail Page — Rich Task Management

## Problem Statement

The Project Detail page's task section is a bare list of titles + status badges with no ability to see task details, filter, sort, or paginate. Tasks lack key PM-facing fields (description, story points). The "Generate 10 Stories" feature produces only titles and acceptance criteria without estimations or skill requirements. For projects with many tasks, the list becomes unusable.

## Changes Summary

1. **Task model gains 2 fields:** `description` (text) and `storyPoints` (int, Fibonacci)
2. **Task list becomes paginated + filterable:** 10 per page, filter by status/assignee, sort by date/status
3. **Expandable task rows:** Click to reveal description, acceptance criteria, story points (editable), skills
4. **"Generate Tasks" replaces "Generate Stories":** PM provides a direction hint, AI generates 3-5 tasks with full details (description, AC, story points, skills) aware of project context and existing tasks
5. **AI estimates story points:** Pre-filled Fibonacci value the PM can override

## Data Model Changes

Add 2 columns to the Task model in `backend/prisma/schema.prisma`:

```prisma
model Task {
  // ... existing fields ...
  description  String?  @map("description")
  storyPoints  Int?     @map("story_points")
}
```

Prisma migration adds nullable columns — no data loss, backward compatible.

Update `backend/src/types.ts`:
- `CreateTaskInput`: add optional `description?: string` and `storyPoints?: number`
- `createTaskSchema`: add `description: z.string().optional()` and `storyPoints: z.number().int().optional()`
- `updateTaskSchema`: add `storyPoints: z.number().int().refine(n => [1,2,3,5,8,13,21].includes(n), 'Must be a Fibonacci number').optional()` — this enables inline editing of story points via `PATCH /api/tasks/:id`

The Fibonacci constraint is **server-enforced** on `updateTaskSchema` (PM edits) but **not enforced** on `createTaskSchema` (AI may produce edge values; the PM can correct later). The LLM prompt constrains it in practice.

Update `frontend/src/lib/types.ts`:
- `Task` interface: add `description: string | null` and `storyPoints: number | null`

Update `frontend/src/lib/api.ts`:
- `UpdateTaskPayload`: add `storyPoints?: number`

Update `backend/src/services/taskService.ts`:
- `updateTask()`: pass `storyPoints` through to Prisma update alongside `status` and `developerId`

Update `backend/src/services/taskUtils.ts`:
- `toPrismaCreate()`: pass `description` and `storyPoints` through to Prisma create data

## Backend Changes

### Modified: `GET /api/projects/:id`

Keep the task select **minimal** — only `{ id, title, status }` for the header task count. The frontend uses the new paginated endpoint for the full task list. This avoids loading hundreds of tasks into the project response.

### New: `GET /api/projects/:id/tasks`

Paginated, filterable task list for a specific project.

```typescript
// Query params
interface ProjectTasksQuery {
  page?: number;       // default 1
  limit?: number;      // default 10
  status?: string;     // 'TODO' | 'IN_PROGRESS' | 'DONE'
  developerId?: string;// uuid or 'unassigned'
  sortBy?: string;     // 'newest' | 'oldest' | 'status' (default: 'newest')
}

// Response
interface ProjectTasksResponse {
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    storyPoints: number | null;
    acceptanceCriteria: string | null;
    skills: Array<{ id: string; name: string }>;
    developer: { id: string; name: string } | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

**Implementation details:**
- Prisma `findMany` with `where`, `orderBy`, `skip: (page - 1) * limit`, `take: limit`
- `developerId` filter: when value is `'unassigned'`, translate to `where: { developerId: null }`. Otherwise use the UUID directly.
- Sorting:
  - `newest`: `orderBy: { createdAt: 'desc' }`
  - `oldest`: `orderBy: { createdAt: 'asc' }`
  - `status`: Use raw ordering — Prisma sorts by `@map` values ("Done" < "In Progress" < "To-do") which is alphabetical, not logical. To get TODO → IN_PROGRESS → DONE, use `orderBy: [{ status: 'desc' }]` (since "To-do" > "In Progress" > "Done" alphabetically, desc gives the desired order).
- `total` count via `prisma.task.count({ where })` for pagination metadata.

**States:**
- **Empty:** No tasks for this project → show "No tasks yet. Generate some or create one below."
- **Empty after filter:** Tasks exist but none match filters → show "No tasks match the current filters."
- **Loading:** Show skeleton rows during fetch
- **Error:** Show error message with retry button

### Modified: `POST /api/tasks`

Accept `description` and `storyPoints` in the request body. Update `createTaskSchema` and `toPrismaCreate()` in `taskUtils.ts` to pass these fields through.

### New: `POST /api/projects/:id/generate-tasks`

Replaces the existing `POST /api/projects/:id/generate-stories` in the frontend. Accepts a direction hint and returns richer task data.

```typescript
// Request
interface GenerateTasksRequest {
  hint: string;  // PM's direction (e.g., "Payment processing with Stripe")
}

// Response
interface GenerateTasksResponse {
  tasks: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string;
    storyPoints: number;     // Fibonacci: 1, 2, 3, 5, 8, 13, 21
    skillNames: string[];    // skill names matched against available skills
  }>;
}
```

**Implementation:** The endpoint must:
1. Fetch the project (with all spec fields)
2. Fetch existing task titles for this project (to avoid duplicates)
3. Fetch all available skills from the database
4. Call the LLM with all this context + the PM's hint
5. Filter returned `skillNames` to only include skills that exist in the DB

The old `generate-stories` endpoint is **removed** — there are no external consumers.

**Skill name-to-ID resolution on "Add Selected":** The generated tasks return `skillNames: string[]`. When the frontend creates tasks via `POST /api/tasks`, it needs `skillIds: string[]`. The frontend resolves this by:
1. Calling `fetchSkills()` to get the full skill list (already cached from page load)
2. Mapping `skillNames` to IDs: `skillNames.map(name => skills.find(s => s.name === name)?.id).filter(Boolean)`

This keeps the backend API consistent (always accepts IDs) and avoids a new endpoint.

### LLM Prompt for Generate Tasks

The endpoint fetches existing task titles with `prisma.task.findMany({ where: { projectId }, select: { title: true } })` before calling the LLM.

```
You are a senior project manager creating software development tasks.

## Project Context
Name: {project.name}
Description: {project.description}
Tech Stack: {project.techStack.join(', ')}
Architecture: {project.architecture}
Domain: {project.domain}
Requirements: {project.requirements}
Constraints: {project.constraints}

## Existing Tasks (avoid duplicates)
{existingTaskTitles.map(t => `- ${t}`).join('\n')}

## Available Skills
{availableSkillNames.join(', ')}

## Direction
{hint}

Generate 3-5 new development tasks in this direction. For each task provide:
- title: user story format ("As a [role], I want [feature] so that [benefit]")
- description: 2-3 sentences of technical implementation detail
- acceptanceCriteria: Gherkin format (Given/When/Then)
- storyPoints: Fibonacci number (1, 2, 3, 5, 8, 13, 21) based on complexity
- skillNames: required skills from the available list above ONLY

Do NOT duplicate existing tasks. Each task should be independently implementable.
```

Zod schema for structured output:
```typescript
const generateTasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.string(),
    storyPoints: z.number().int(),
    skillNames: z.array(z.string()),
  })),
});
```

## Frontend Changes

### Modified: `frontend/src/lib/types.ts`

```typescript
// Add to Task interface
description: string | null;
storyPoints: number | null;

// New interface
interface ProjectTasksPage {
  tasks: Task[];
  total: number;
  page: number;
  totalPages: number;
}

// Update GeneratedTask (replaces GeneratedStory for this flow)
interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number;
  skillNames: string[];
}
```

### Modified: `frontend/src/lib/api.ts`

```typescript
// New: paginated project tasks
fetchProjectTasks(projectId, { page, limit, status, developerId, sortBy }): Promise<ProjectTasksPage>

// New: generate tasks with hint
generateTasksFromHint(projectId, hint): Promise<{ tasks: GeneratedTask[] }>

// Modified: UpdateTaskPayload — add storyPoints
interface UpdateTaskPayload {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  developerId?: string | null;
  storyPoints?: number;  // NEW
}
```

### Modified: `frontend/src/pages/ProjectDetailPage.tsx`

The page is restructured into sections:

**1. Project Header** (unchanged) — name, description, tech stack badges, Refine with AI button

**2. Spec Tabs** (unchanged) — Architecture, Domain, Requirements, Constraints, Stakeholders

**3. Task Management Section** — replaces both "Generate User Stories" and "Project Tasks":

- **Filter bar:** Status dropdown + Assignee dropdown (loaded via `fetchDevelopers()`) + Sort dropdown (Newest / Oldest / Status)
- **Task table:** Paginated, 10 per page. Each row: title (truncated), status badge, assignee name, story points pill, creation date
- **Expandable rows:** Click a row to accordion-expand showing:
  - Description (read-only)
  - Acceptance criteria (read-only, Gherkin formatted in a `<pre>` block)
  - Story points (editable Fibonacci dropdown: 1, 2, 3, 5, 8, 13, 21) — saves on change via `PATCH /api/tasks/:id` with `{ storyPoints }`
  - Required skills as badges
  - Assignee name
- **Pagination controls:** "Page 1 of N" with Prev/Next buttons
- **Generate Tasks panel:** Text input for direction hint + "Generate Tasks" button. Shows generated tasks as expandable cards with checkboxes showing title, description, AC, story points, skills. "Add Selected" resolves skill names to IDs (from cached skill list) and creates tasks via `POST /api/tasks` for each.

**"Create Task inline" is removed** — the PM uses either "Generate Tasks" with a hint or the existing `/tasks/new` page (linked from the task management section header). This avoids the complexity of a secondary AI auto-population flow and keeps the page focused.

### FIBONACCI_POINTS constant

```typescript
const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;
```

Used in the story points dropdown (task detail accordion) and the backend `updateTaskSchema` Zod validation.

## Out of Scope

- Inline editing of task title or description (only story points are editable inline)
- Bulk operations (bulk assign, bulk delete)
- Task reordering / drag-and-drop within the project task list
- Task dependency chains
- Time tracking / actual vs estimated
- "Create Task inline" on the project detail page — use `/tasks/new` instead
