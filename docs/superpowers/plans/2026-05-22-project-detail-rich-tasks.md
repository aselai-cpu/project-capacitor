# Project Detail — Rich Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Project Detail page with paginated/filterable/expandable tasks, AI-powered task generation with direction hints, Fibonacci story points, and richer task details (description, AC, story points, skills).

**Architecture:** Prisma schema gains 2 nullable columns (description, storyPoints) on Task. New paginated endpoint for project tasks. New LLM function generates tasks with full details. The ProjectDetailPage is rewritten with a task management section featuring filters, expandable accordion rows, and a generate-tasks panel with hint input.

**Tech Stack:** Express, Prisma, Zod, Vercel AI SDK (backend); React, Tailwind CSS (frontend); Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-05-22-project-detail-rich-task-management.md`

---

## File Map

### Backend — Modified
- `backend/prisma/schema.prisma` — add `description` and `storyPoints` to Task
- `backend/src/types.ts` — update CreateTaskInput, createTaskSchema, updateTaskSchema
- `backend/src/services/taskUtils.ts` — update toPrismaCreate + TaskWithRelations
- `backend/src/services/taskService.ts` — pass storyPoints through updateTask
- `backend/src/services/projectService.ts` — add getProjectTasks()
- `backend/src/services/llmService.ts` — add generateTasks() function
- `backend/src/routes/projects.ts` — add GET /:id/tasks, POST /:id/generate-tasks

### Frontend — Modified
- `frontend/src/lib/types.ts` — add description/storyPoints to Task, new interfaces
- `frontend/src/lib/api.ts` — add fetchProjectTasks, generateTasksFromHint, update UpdateTaskPayload
- `frontend/src/pages/ProjectDetailPage.tsx` — full rewrite of task management section

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add description and storyPoints to Task model**

In `backend/prisma/schema.prisma`, add these two lines to the Task model, after the `acceptanceCriteria` field (line 52):

```prisma
  description        String?    @map("description")
  storyPoints        Int?       @map("story_points")
```

- [ ] **Step 2: Push schema to database**

Run: `cd backend && npx prisma db push`
Expected: Schema synced, no data loss (nullable columns)

- [ ] **Step 3: Regenerate Prisma client**

Run: `cd backend && npx prisma generate`

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add description and storyPoints fields to Task model

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend Types + Task Utils Update

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/services/taskUtils.ts`
- Modify: `backend/src/services/taskService.ts`

- [ ] **Step 1: Update CreateTaskInput and schemas in types.ts**

In `backend/src/types.ts`:

Update `CreateTaskInput` interface — add after `acceptanceCriteria`:
```typescript
  description?: string;
  storyPoints?: number;
```

Update `createTaskSchema` — add before the closing `})`:
```typescript
  description: z.string().optional(),
  storyPoints: z.number().int().optional(),
```

Update `updateTaskSchema` — add `storyPoints`:
```typescript
export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  developerId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().refine(
    n => [1, 2, 3, 5, 8, 13, 21].includes(n),
    'Must be a Fibonacci number (1, 2, 3, 5, 8, 13, 21)'
  ).optional(),
});
```

- [ ] **Step 2: Update TaskWithRelations in taskUtils.ts**

In `backend/src/services/taskUtils.ts`, add to `TaskWithRelations` interface:
```typescript
  description: string | null;
  storyPoints: number | null;
```

- [ ] **Step 3: Update toPrismaCreate in taskUtils.ts**

In `backend/src/services/taskUtils.ts`, update the `toPrismaCreate` function. Add after the `acceptanceCriteria` line:
```typescript
    ...(node.description ? { description: node.description } : {}),
    ...(node.storyPoints !== undefined && node.storyPoints !== null ? { storyPoints: node.storyPoints } : {}),
```

- [ ] **Step 4: Update updateTask in taskService.ts**

In `backend/src/services/taskService.ts`, in the `updateTask` function, update the `updateData` type and assignment:

Change:
```typescript
  const updateData: { status?: TaskStatus; developerId?: string | null } = {};
```
To:
```typescript
  const updateData: { status?: TaskStatus; developerId?: string | null; storyPoints?: number } = {};
```

Add after the `developerId` assignment:
```typescript
  if (data.storyPoints !== undefined) updateData.storyPoints = data.storyPoints;
```

Also update the `data` parameter type to include `storyPoints?: number`.

- [ ] **Step 5: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add backend/src/types.ts backend/src/services/taskUtils.ts backend/src/services/taskService.ts
git commit -m "feat: add description/storyPoints to task schemas, utils, and update service

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Paginated Project Tasks Endpoint

**Files:**
- Modify: `backend/src/services/projectService.ts`
- Modify: `backend/src/routes/projects.ts`

- [ ] **Step 1: Add getProjectTasks to projectService.ts**

Add to `backend/src/services/projectService.ts`:

```typescript
export interface ProjectTasksParams {
  page: number;
  limit: number;
  status?: string;
  developerId?: string;
  sortBy: string;
}

export async function getProjectTasks(projectId: string, params: ProjectTasksParams) {
  const where: Record<string, unknown> = { projectId };
  if (params.status) where.status = params.status;
  if (params.developerId) {
    where.developerId = params.developerId === 'unassigned' ? null : params.developerId;
  }

  const orderBy: Record<string, string> = {};
  if (params.sortBy === 'oldest') orderBy.createdAt = 'asc';
  else if (params.sortBy === 'status') orderBy.status = 'desc'; // "To-do" > "In Progress" > "Done" alphabetically
  else orderBy.createdAt = 'desc'; // default: newest

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        skills: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    total,
    page: params.page,
    totalPages: Math.ceil(total / params.limit),
  };
}
```

- [ ] **Step 2: Add the route in projects.ts**

In `backend/src/routes/projects.ts`, add after the `GET /:id` route (after line 19):

```typescript
// GET /api/projects/:id/tasks — Paginated project tasks
router.get('/:id/tasks', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const status = req.query.status as string | undefined;
  const developerId = req.query.developerId as string | undefined;
  const sortBy = (req.query.sortBy as string) || 'newest';

  const result = await projectService.getProjectTasks(req.params.id as string, {
    page, limit, status, developerId, sortBy,
  });
  res.json(result);
}));
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/projectService.ts backend/src/routes/projects.ts
git commit -m "feat: add GET /api/projects/:id/tasks with pagination, filtering, and sorting

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Generate Tasks LLM Function + Route

**Files:**
- Modify: `backend/src/services/llmService.ts`
- Modify: `backend/src/routes/projects.ts`

- [ ] **Step 1: Add generateTasks function to llmService.ts**

Add at the end of `backend/src/services/llmService.ts`:

```typescript
// --- Task generation with direction hint ---

const generateTasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.string(),
    storyPoints: z.number().int(),
    skillNames: z.array(z.string()),
  })),
});

export interface GenerateTasksContext {
  name: string;
  description?: string;
  techStack: string[];
  architecture?: string;
  domain?: string;
  requirements?: string;
  constraints?: string;
  existingTaskTitles: string[];
  availableSkillNames: string[];
  hint: string;
}

export async function generateTasks(ctx: GenerateTasksContext) {
  const model = await getModel();
  const { object } = await generateObject({
    model,
    schema: generateTasksSchema,
    prompt: `You are a senior project manager creating software development tasks.

## Project Context
Name: ${ctx.name}
Description: ${ctx.description || 'N/A'}
Tech Stack: ${ctx.techStack.join(', ') || 'N/A'}
Architecture: ${ctx.architecture || 'N/A'}
Domain: ${ctx.domain || 'N/A'}
Requirements: ${ctx.requirements || 'N/A'}
Constraints: ${ctx.constraints || 'N/A'}

## Existing Tasks (avoid duplicates)
${ctx.existingTaskTitles.length > 0 ? ctx.existingTaskTitles.map(t => `- ${t}`).join('\n') : 'None yet'}

## Available Skills
${ctx.availableSkillNames.join(', ')}

## Direction
${ctx.hint}

Generate 3-5 new development tasks in this direction. For each task provide:
- title: user story format ("As a [role], I want [feature] so that [benefit]")
- description: 2-3 sentences of technical implementation detail
- acceptanceCriteria: Gherkin format (Given/When/Then)
- storyPoints: Fibonacci number (1, 2, 3, 5, 8, 13, 21) based on complexity
- skillNames: required skills from the available list above ONLY

Do NOT duplicate existing tasks. Each task should be independently implementable.`,
    experimental_telemetry: {
      isEnabled: true,
      metadata: { feature: 'generate-tasks', projectName: ctx.name },
    },
  });

  // Filter skillNames to only include skills that exist in the available list
  return {
    tasks: object.tasks.map(t => ({
      ...t,
      skillNames: t.skillNames.filter(s => ctx.availableSkillNames.includes(s)),
    })),
  };
}
```

- [ ] **Step 2: Add the generate-tasks route**

In `backend/src/routes/projects.ts`, add the import for `generateTasks`:

```typescript
import { enrichProject, generateUserStories, generateTasks } from '../services/llmService.js';
```

Also add an import for prisma (if not already imported):
```typescript
import prisma from '../lib/prisma.js';
```

Add the route after the `generate-stories` route:

```typescript
// LLM: Generate tasks with direction hint
router.post('/:id/generate-tasks', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const { hint } = req.body as { hint?: string };
  if (!hint || typeof hint !== 'string') {
    res.status(400).json({ error: 'hint is required' }); return;
  }

  try {
    // Fetch existing task titles and available skills
    const [existingTasks, skills] = await Promise.all([
      prisma.task.findMany({ where: { projectId: project.id }, select: { title: true } }),
      prisma.skill.findMany({ select: { name: true } }),
    ]);

    const result = await generateTasks({
      name: project.name,
      description: project.description || undefined,
      techStack: project.techStack,
      architecture: project.architecture || undefined,
      domain: project.domain || undefined,
      requirements: project.requirements || undefined,
      constraints: project.constraints || undefined,
      existingTaskTitles: existingTasks.map(t => t.title),
      availableSkillNames: skills.map(s => s.name),
      hint,
    });

    res.json(result);
  } catch (err) {
    logger.warn({ err, projectId: project.id }, 'LLM task generation failed');
    res.status(502).json({ error: 'AI task generation failed — try again later' });
  }
}));
```

- [ ] **Step 3: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/llmService.ts backend/src/routes/projects.ts
git commit -m "feat: add generate-tasks LLM function with direction hint and project context

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend Types + API Functions

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update types.ts**

In `frontend/src/lib/types.ts`:

Add `description` and `storyPoints` to the `Task` interface (after `acceptanceCriteria`):
```typescript
  description: string | null;
  storyPoints: number | null;
```

Add new interfaces at the end:
```typescript
export interface ProjectTasksPage {
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    storyPoints: number | null;
    acceptanceCriteria: string | null;
    skills: Skill[];
    developer: { id: string; name: string } | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number;
  skillNames: string[];
}
```

- [ ] **Step 2: Update api.ts**

Update the import line to include new types:
```typescript
import type { ..., ProjectTasksPage, GeneratedTask } from './types';
```

Update `UpdateTaskPayload` — add `storyPoints`:
```typescript
export interface UpdateTaskPayload {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  developerId?: string | null;
  storyPoints?: number;
}
```

Add new API functions at the end:
```typescript
// --- Project Tasks (paginated) ---

export const fetchProjectTasks = (
  projectId: string,
  params?: { page?: number; limit?: number; status?: string; developerId?: string; sortBy?: string }
): Promise<ProjectTasksPage> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.developerId) qs.set('developerId', params.developerId);
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  const q = qs.toString();
  return fetch(`${API}/api/projects/${projectId}/tasks${q ? `?${q}` : ''}`).then(r => handleResponse<ProjectTasksPage>(r));
};

export const generateTasksFromHint = (projectId: string, hint: string): Promise<{ tasks: GeneratedTask[] }> =>
  fetch(`${API}/api/projects/${projectId}/generate-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hint }),
  }).then(r => handleResponse<{ tasks: GeneratedTask[] }>(r));
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add frontend types and API functions for paginated project tasks and generate-tasks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rewrite ProjectDetailPage — Task Management Section

**Files:**
- Modify: `frontend/src/pages/ProjectDetailPage.tsx`

This is the largest task — the entire task management section (story generation + task list) is replaced.

- [ ] **Step 1: Rewrite ProjectDetailPage**

Replace the entire content of `frontend/src/pages/ProjectDetailPage.tsx`. The new version keeps the Header and Spec Tabs unchanged, and replaces the Story Generation + Project Tasks sections with a unified Task Management Section.

Key components in the rewrite:
- **Filter bar:** Status dropdown + Assignee dropdown + Sort dropdown
- **Paginated task table:** 10 per page, each row expandable on click
- **Expanded row accordion:** Description, acceptance criteria (pre-formatted), story points (editable dropdown), skills, assignee
- **Generate Tasks panel:** Hint text input + "Generate Tasks" button → shows generated tasks with checkboxes → "Add Selected" creates tasks with description/AC/storyPoints/skills
- **Pagination:** Page N of M with Prev/Next

The page imports: `fetchProject`, `enrichProjectApi`, `fetchProjectTasks`, `generateTasksFromHint`, `createTask`, `updateTask`, `fetchDevelopers`, `fetchSkills`.

The `FIBONACCI_POINTS` constant: `[1, 2, 3, 5, 8, 13, 21] as const`.

Story points dropdown in expanded row saves on change via `updateTask(taskId, { storyPoints })`.

Skill name-to-ID resolution when adding generated tasks: uses the fetched skills list to map `skillNames` → `skillIds`.

Due to the size of this component (~300 lines), the implementer should:
1. Read the current file fully
2. Keep the Header section (lines 97-118) and Spec Tabs section (lines 120-151) as-is
3. Replace everything from `{/* Story Generation Panel */}` (line 153) to the end of the component with the new task management section
4. Add new state variables at the top for: pagination (page, taskData), filters (filterStatus, filterDeveloper, sortBy), task expansion (expandedTaskId), generate-tasks (hint, generatedTasks, selectedGenerated, generating), developers list, skills list

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All pass. If any existing tests reference `GeneratedStory` from the old flow, they may need updating.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectDetailPage.tsx
git commit -m "feat: rewrite ProjectDetailPage with paginated task list, expandable rows, and AI task generation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All pass

- [ ] **Step 3: TypeScript compile check**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build check**

Run: `cd frontend && npm run build`
Expected: Clean build
