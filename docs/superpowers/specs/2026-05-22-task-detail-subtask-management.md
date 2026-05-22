# Task Detail Page + Subtask Management + Task Deletion

## Problem Statement

The task creation flow (`/tasks/new`) is disconnected from projects — it doesn't associate tasks with a project context. There is no way to manage subtasks (generate, view tree, delete), no task deletion capability, and no dedicated page to view a task's full details. The PM has to use fragmented UI pieces across multiple pages.

## Changes Summary

1. **New Task Detail Page** (`/tasks/:id`) — dedicated page for viewing task details, managing subtask tree, AI-generating subtasks, deleting tasks
2. **Subtask tree management** — recursive display, delete at any level, click to drill into subtask's own detail page
3. **AI subtask generation** — hint-based, scoped to breaking down a parent task using project + task context
4. **Task deletion** — `DELETE /api/tasks/:id` endpoint, delete buttons on task detail and subtask rows
5. **Remove `/tasks/new`** — task creation moves to Project Detail page (inline) and subtask creation to Task Detail page (AI generate)

## New Page: Task Detail (`/tasks/:id`)

### Layout

**Header section:**
- Task title (large heading)
- Project name as a link to `/projects/:projectId` (if associated)
- Status badge (To-do / In Progress / Done)
- Assignee name
- Story points (editable Fibonacci dropdown, saves on change via `PATCH /api/tasks/:id`)
- Delete button (red, right-aligned) — confirmation dialog, then `DELETE /api/tasks/:id`

**Details section:**
- Description (read-only text block)
- Acceptance criteria (read-only, `<pre>` with whitespace-pre-wrap for Gherkin formatting)
- Skills as badges

**Subtasks section:**
- Heading: "Subtasks (N)" with count
- Recursive subtask tree (see below)
- AI Generate Subtasks panel at the bottom

### Subtask Tree Display

Subtasks render as an indented tree supporting arbitrary nesting (subtask of subtask of subtask). Each node shows:

```
├─ Subtask title                    TODO   3 pts   [🗑]
│  ├─ Sub-subtask title             PROG   2 pts   [🗑]
│  └─ Sub-subtask title             TODO   1 pt    [🗑]
└─ Subtask title                    DONE   5 pts   [🗑]
```

- **Expand/collapse:** Arrow toggle to show/hide children
- **Title is a link:** Clicking the title navigates to `/tasks/:subtaskId` (recursive — every subtask is also a task with its own detail page)
- **Status badge:** Colored badge
- **Story points:** Displayed as a pill
- **Delete button:** Trash icon per row. On click, confirmation dialog: "Delete this subtask and all its children?" Then `DELETE /api/tasks/:subtaskId`. Refreshes the parent tree.

### AI Generate Subtasks

Same pattern as project-level "Generate Tasks" but scoped to one task:

- **Hint input:** Text field — "Describe what subtasks to generate..."
- **Generate button:** Calls `POST /api/tasks/:id/generate-subtasks` with `{ hint }`
- **Results:** 3-5 generated subtasks shown as expandable cards with checkboxes. Each card shows title, description, acceptance criteria, story points, skills.
- **"Add Selected":** Creates each selected subtask via `POST /api/tasks` with `parentId` set to the current task.

**Context sent to LLM:**
- Parent task: title, description, acceptance criteria, skills
- Project: name, description, tech stack, architecture, domain, requirements (if task has a projectId)
- Existing subtask titles (to avoid duplicates)
- Available skill names
- PM's hint

## Remove `/tasks/new`

### What changes:
- **Remove** the following files:
  - `frontend/src/pages/TaskCreatePage.tsx`
  - `frontend/src/components/TaskFormNode.tsx`
  - `frontend/src/utils/treeUtils.ts`
  - `frontend/src/__tests__/TaskCreatePage.test.tsx`
  - `frontend/src/__tests__/TaskFormNode.test.tsx`
  - `frontend/src/__tests__/treeUtils.test.ts`
- **Remove** the `/tasks/new` route from `App.tsx` and the `TaskCreatePage` import
- **Project Detail page:** The "+ Create Task" link at the bottom becomes an **inline creation form** — title input + description textarea + "Create" button. Only these 2 fields (title + description). No skills, story points, or acceptance criteria — those are managed on the Task Detail page after creation, or auto-populated by the server-side LLM classification. Creates a task via `POST /api/tasks` with `projectId`. After creation, refreshes the task list and the PM can click into the new task to manage subtasks.
- **Task List page:** The "Create Task" button in the header is **removed** (tasks are created from Project Detail). The "+ Subtask" link per row changes from linking to `/tasks/new?parentId=` to navigating to `/tasks/:id` (the parent task's detail page, where subtask management lives).
- **NavBar:** No changes needed — it doesn't have a "Create Task" link.

### What stays:
- `POST /api/tasks` endpoint (unchanged — still accepts title, skillIds, parentId, projectId, description, storyPoints, acceptanceCriteria)
- Server-side LLM skill classification fallback (still runs for tasks created without skills)

## Backend Changes

### New: `DELETE /api/tasks/:id`

Deletes a single task. Prisma's `onDelete: Cascade` on the Task self-relation automatically deletes all subtasks.

```typescript
// Route: DELETE /api/tasks/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id as string } });
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  await prisma.task.delete({ where: { id: req.params.id as string } });
  res.json({ deleted: true });
}));
```

Note: The existing bulk `DELETE /api/tasks` (test cleanup) is kept for E2E tests. The new single-task delete is at `DELETE /api/tasks/:id` — no route conflict since the bulk delete has no `:id` param.

### New: `POST /api/tasks/:id/generate-subtasks`

Generates subtasks for a specific parent task.

```typescript
// Request
interface GenerateSubtasksRequest {
  hint: string;
}

// Response — same shape as generate-tasks
interface GenerateSubtasksResponse {
  tasks: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string;
    storyPoints: number;
    skillNames: string[];
  }>;
}
```

**Implementation:**
1. Fetch the parent task (with skills, project)
2. If task has a projectId, fetch the project (all spec fields)
3. Fetch existing subtask titles for this task
4. Fetch all available skills
5. Call LLM with combined context

**LLM Prompt:**
```
You are a senior developer breaking down a task into smaller, independently implementable subtasks.

## Parent Task
Title: {task.title}
Description: {task.description}
Acceptance Criteria: {task.acceptanceCriteria}
Required Skills: {task.skills.map(s => s.name).join(', ')}

## Project Context
Name: {project.name}
Tech Stack: {project.techStack.join(', ')}
Architecture: {project.architecture}

## Existing Subtasks (avoid duplicates)
{existingSubtaskTitles}

## Available Skills
{availableSkillNames}

## Direction
{hint}

Generate 3-5 granular, workable subtasks. Each subtask should be small enough for one developer to complete in 1-3 days. For each provide:
- title: clear action ("Implement X", "Create Y", "Configure Z")
- description: 2-3 sentences of implementation detail
- acceptanceCriteria: Gherkin format
- storyPoints: Fibonacci (1, 2, 3, 5, 8, 13, 21)
- skillNames: from available list
```

The `generateSubtasks` function goes in `backend/src/services/llmService.ts` alongside the existing `generateTasks`. The route handler goes in `backend/src/routes/tasks.ts`. On LLM failure, return 502 with `{ error: 'AI subtask generation failed — try again later' }`. Frontend shows an alert on error.

### Modified: `GET /api/tasks/:id`

The existing endpoint returns a recursive task tree via `buildTree()`. Update the existing `taskInclude` constant in `taskService.ts` to also include `project`:

```typescript
const taskInclude = {
  skills: { select: { id: true, name: true } },
  developer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
};
```

Also update `TaskWithRelations` in `taskUtils.ts` to include:
```typescript
  project: { id: string; name: string } | null;
```

The `description` and `storyPoints` fields are already on the model and will be returned automatically by Prisma — no explicit select needed.

## Frontend Changes

### New: `frontend/src/pages/TaskDetailPage.tsx`

The main new component. Receives task ID from URL params, fetches the task tree, and renders:
- Header with task info + delete button
- Details section (description, AC, skills)
- Subtask tree (recursive component)
- Generate subtasks panel

### New: `frontend/src/components/SubtaskTree.tsx`

Recursive component that renders a subtask and its children. Each node:
- Indented by depth
- Expand/collapse toggle
- Title as `<Link to={/tasks/${subtask.id}}>`
- Status badge, story points pill
- Delete button (trash icon)

### Modified: `frontend/src/App.tsx`

```
- Remove: /tasks/new route and TaskCreatePage import
- Add: /tasks/:id → TaskDetailPage
```

Note: The existing `/tasks/:id` route doesn't exist yet — currently tasks are only viewed in lists. This is a new route.

### Modified: `frontend/src/lib/api.ts`

```typescript
// New functions
deleteTask(id: string): Promise<{ deleted: boolean }>
generateSubtasks(taskId: string, hint: string): Promise<{ tasks: GeneratedTask[] }>
fetchTask(id: string): Promise<TaskTree>  // full tree with project info
```

### Modified: `frontend/src/lib/types.ts`

```typescript
// New interface for task tree (recursive)
interface TaskTree {
  id: string;
  title: string;
  description: string | null;
  status: string;
  storyPoints: number | null;
  acceptanceCriteria: string | null;
  skills: Skill[];
  developer: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  parentId: string | null;
  createdAt: string;
  subtasks: TaskTree[];
}
```

### Modified: `frontend/src/pages/ProjectDetailPage.tsx`

- Replace "+ Create Task" link with an inline creation form: title input + description textarea + "Create" button
- Task rows in the paginated list become links: clicking the title navigates to `/tasks/:id`

### Modified: `frontend/src/components/TaskRow.tsx`

- The "+ Subtask" link changes from `/tasks/new?parentId=` to `/tasks/:id` (navigate to parent's detail page)
- Add a delete button (small trash icon) that calls `deleteTask(task.id)` with confirmation

### Modified: `frontend/src/pages/TaskListPage.tsx`

- Task titles become links to `/tasks/:id`

## Navigation Flow

```
Project Detail → click task title → Task Detail (/tasks/:id)
Task Detail → click subtask title → Subtask Detail (/tasks/:subtaskId)
Task Detail → "Generate Subtasks" → add subtasks
Task Detail → "Delete Task" → confirmation → navigate to /projects/:projectId (if task has project) or /tasks (if orphan)
Task List → click task title → Task Detail
Task List → delete button → confirmation → refresh list
```

## Out of Scope

- Inline editing of task title or description (navigate to task detail for that)
- Moving tasks between projects
- Reordering subtasks
- Subtask progress percentage ("3 of 5 subtasks done")
- Bulk subtask operations
