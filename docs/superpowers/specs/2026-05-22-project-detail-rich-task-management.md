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

Update `frontend/src/lib/types.ts`:
- `Task` interface: add `description: string | null` and `storyPoints: number | null`

## Backend Changes

### Modified: `GET /api/projects/:id`

The existing endpoint already includes `tasks` in the response but only selects `{ id, title, status }`. Expand to include: `{ id, title, status, description, storyPoints, acceptanceCriteria, developerId, createdAt }` and include `skills` and `developer` relations.

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

Implementation uses Prisma `findMany` with `where`, `orderBy`, `skip`, `take`. Sorting:
- `newest`: `createdAt: 'desc'`
- `oldest`: `createdAt: 'asc'`
- `status`: `status: 'asc'` (TODO → IN_PROGRESS → DONE)

### Modified: `POST /api/tasks`

Accept `description` and `storyPoints` in the request body. Update `createTaskSchema` and `toPrismaCreate()` in `taskUtils.ts` to pass these fields through.

### New: `POST /api/projects/:id/generate-tasks`

Replaces the existing `POST /api/projects/:id/generate-stories`. Accepts a direction hint and returns richer task data.

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
    skillNames: string[];    // skill names matched against DB
  }>;
}
```

The old `generate-stories` endpoint is **kept for backward compatibility** but the frontend switches to using `generate-tasks`.

### LLM Prompt for Generate Tasks

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
- skillNames: required skills from the available list above

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

// New interface for generated tasks
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
generateTasks(projectId, hint): Promise<{ tasks: GeneratedTask[] }>
```

### Modified: `frontend/src/pages/ProjectDetailPage.tsx`

The page is restructured into sections:

**1. Project Header** (unchanged) — name, description, tech stack badges, Refine with AI button

**2. Spec Tabs** (unchanged) — Architecture, Domain, Requirements, Constraints, Stakeholders

**3. Task Management Section** — replaces both "Generate User Stories" and "Project Tasks":

- **Filter bar:** Status dropdown + Assignee dropdown + Sort dropdown
- **Task table:** Paginated, 10 per page. Each row: title, status badge, assignee, story points, date
- **Expandable rows:** Click to accordion-expand showing:
  - Description (read-only)
  - Acceptance criteria (read-only, Gherkin formatted)
  - Story points (editable Fibonacci dropdown: 1, 2, 3, 5, 8, 13, 21) — saves on change via `PATCH /api/tasks/:id`
  - Required skills as badges
  - Assignee
- **Pagination controls:** "Page 1 of N" with Prev/Next buttons
- **Generate Tasks panel:** Text input for direction hint + "Generate Tasks" button. Shows generated tasks as expandable cards with checkboxes. "Add Selected" creates tasks with all AI-generated fields.
- **Create Task inline:** Simple form (title + description) at the bottom. Skills and story points auto-populated by AI after creation.

### FIBONACCI_POINTS constant

```typescript
const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;
```

Used in both the story points dropdown (task detail) and the Zod validation schema (backend).

## Out of Scope

- Inline editing of task title or description (only story points are editable inline)
- Bulk operations (bulk assign, bulk delete)
- Task reordering / drag-and-drop within the project task list
- Task dependency chains
- Time tracking / actual vs estimated
