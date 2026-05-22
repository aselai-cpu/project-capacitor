# Task Detail + Subtask Management + Task Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Task Detail page (`/tasks/:id`) with recursive subtask tree, AI subtask generation, task deletion, and replace the standalone task creation page with project-contextual flows.

**Architecture:** Backend gains `DELETE /api/tasks/:id` and `POST /api/tasks/:id/generate-subtasks` endpoints. `taskInclude` is updated to include project relation. Frontend gets TaskDetailPage with SubtaskTree component. TaskCreatePage and related files are removed; inline task creation moves to ProjectDetailPage. TaskListPage and TaskRow are updated to link to task detail and support deletion.

**Tech Stack:** Express, Prisma, Zod, Vercel AI SDK (backend); React, React Router, Tailwind CSS (frontend); Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-05-22-task-detail-subtask-management.md`

---

## File Map

### Backend — Modified
- `backend/src/services/taskService.ts` — update `taskInclude` to include project, add `deleteTask`
- `backend/src/services/taskUtils.ts` — add `project` to `TaskWithRelations`
- `backend/src/services/llmService.ts` — add `generateSubtasks` function
- `backend/src/routes/tasks.ts` — add `DELETE /:id`, `POST /:id/generate-subtasks`

### Frontend — New
- `frontend/src/pages/TaskDetailPage.tsx` — task detail page with subtask management
- `frontend/src/components/SubtaskTree.tsx` — recursive subtask tree component

### Frontend — Modified
- `frontend/src/App.tsx` — add `/tasks/:id`, remove `/tasks/new`
- `frontend/src/lib/api.ts` — add `deleteTask`, `generateSubtasks`, `fetchTask`
- `frontend/src/lib/types.ts` — add `TaskTree` interface
- `frontend/src/pages/ProjectDetailPage.tsx` — inline task creation form, task title links
- `frontend/src/pages/TaskListPage.tsx` — remove "Create Task" button, task title links
- `frontend/src/components/TaskRow.tsx` — change subtask link, add delete button

### Frontend — Remove
- `frontend/src/pages/TaskCreatePage.tsx`
- `frontend/src/components/TaskFormNode.tsx`
- `frontend/src/utils/treeUtils.ts`
- `frontend/src/__tests__/TaskCreatePage.test.tsx`
- `frontend/src/__tests__/TaskFormNode.test.tsx`
- `frontend/src/__tests__/treeUtils.test.ts`

---

## Task 1: Backend — Update taskInclude + TaskWithRelations + Delete Endpoint

**Files:**
- Modify: `backend/src/services/taskService.ts`
- Modify: `backend/src/services/taskUtils.ts`
- Modify: `backend/src/routes/tasks.ts`

- [ ] **Step 1: Add `project` to taskInclude in taskService.ts**

In `backend/src/services/taskService.ts`, update the `taskInclude` constant (line 11-14):

```typescript
const taskInclude = {
  skills: { select: { id: true, name: true } },
  developer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
};
```

- [ ] **Step 2: Add `project` to TaskWithRelations in taskUtils.ts**

In `backend/src/services/taskUtils.ts`, add to the `TaskWithRelations` interface after `developer`:

```typescript
  project: { id: string; name: string } | null;
```

- [ ] **Step 3: Add deleteTask function to taskService.ts**

Add at the end of `backend/src/services/taskService.ts`:

```typescript
// --- DELETE /api/tasks/:id (single task with cascade) ---
export async function deleteTask(id: string): Promise<boolean> {
  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  await prisma.task.delete({ where: { id } });
  return true;
}
```

- [ ] **Step 4: Add DELETE /:id route to tasks.ts**

In `backend/src/routes/tasks.ts`, add BEFORE the bulk `DELETE /` route (before line 58):

```typescript
// DELETE /api/tasks/:id — Delete single task (cascades to subtasks)
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await taskService.deleteTask(req.params.id as string);
  if (!deleted) { res.status(404).json({ error: 'Task not found' }); return; }
  res.json({ deleted: true });
}));
```

- [ ] **Step 5: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/taskService.ts backend/src/services/taskUtils.ts backend/src/routes/tasks.ts
git commit -m "feat: add project to task include, add DELETE /api/tasks/:id endpoint

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — Generate Subtasks LLM Function + Route

**Files:**
- Modify: `backend/src/services/llmService.ts`
- Modify: `backend/src/routes/tasks.ts`

- [ ] **Step 1: Add generateSubtasks function to llmService.ts**

Add at the end of `backend/src/services/llmService.ts`:

```typescript
// --- Subtask generation ---

const generateSubtasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.string(),
    storyPoints: z.number().int(),
    skillNames: z.array(z.string()),
  })),
});

export interface GenerateSubtasksContext {
  taskTitle: string;
  taskDescription?: string;
  taskAcceptanceCriteria?: string;
  taskSkills: string[];
  projectName?: string;
  projectTechStack?: string[];
  projectArchitecture?: string;
  existingSubtaskTitles: string[];
  availableSkillNames: string[];
  hint: string;
}

export async function generateSubtasks(ctx: GenerateSubtasksContext) {
  const model = await getModel();
  const { object } = await generateObject({
    model,
    schema: generateSubtasksSchema,
    prompt: `You are a senior developer breaking down a task into smaller, independently implementable subtasks.

## Parent Task
Title: ${ctx.taskTitle}
Description: ${ctx.taskDescription || 'N/A'}
Acceptance Criteria: ${ctx.taskAcceptanceCriteria || 'N/A'}
Required Skills: ${ctx.taskSkills.join(', ') || 'N/A'}

${ctx.projectName ? `## Project Context
Name: ${ctx.projectName}
Tech Stack: ${ctx.projectTechStack?.join(', ') || 'N/A'}
Architecture: ${ctx.projectArchitecture || 'N/A'}` : ''}

## Existing Subtasks (avoid duplicates)
${ctx.existingSubtaskTitles.length > 0 ? ctx.existingSubtaskTitles.map(t => `- ${t}`).join('\n') : 'None yet'}

## Available Skills
${ctx.availableSkillNames.join(', ')}

## Direction
${ctx.hint}

Generate 3-5 granular, workable subtasks. Each subtask should be small enough for one developer to complete in 1-3 days. For each provide:
- title: clear action ("Implement X", "Create Y", "Configure Z")
- description: 2-3 sentences of implementation detail
- acceptanceCriteria: Gherkin format (Given/When/Then)
- storyPoints: Fibonacci number (1, 2, 3, 5, 8, 13, 21) based on complexity
- skillNames: required skills from the available list above ONLY

Do NOT duplicate existing subtasks. Each subtask should be independently implementable.`,
    experimental_telemetry: {
      isEnabled: true,
      metadata: { feature: 'generate-subtasks', taskTitle: ctx.taskTitle },
    },
  });

  return {
    tasks: object.tasks.map(t => ({
      ...t,
      skillNames: t.skillNames.filter(s => ctx.availableSkillNames.includes(s)),
    })),
  };
}
```

- [ ] **Step 2: Add POST /:id/generate-subtasks route**

In `backend/src/routes/tasks.ts`, add the import for `generateSubtasks`:

Update the llmService import line:
```typescript
import { classifySkills, generateSubtasks } from '../services/llmService.js';
```

Add the route BEFORE the bulk DELETE (before the `DELETE /` route):

```typescript
// POST /api/tasks/:id/generate-subtasks — AI subtask generation
router.post('/:id/generate-subtasks', asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: { skills: true, project: true },
  });
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  const { hint } = req.body as { hint?: string };
  if (!hint || typeof hint !== 'string') {
    res.status(400).json({ error: 'hint is required' }); return;
  }

  try {
    const [existingSubtasks, skills] = await Promise.all([
      prisma.task.findMany({ where: { parentId: task.id }, select: { title: true } }),
      prisma.skill.findMany({ select: { name: true } }),
    ]);

    const result = await generateSubtasks({
      taskTitle: task.title,
      ...(task.description ? { taskDescription: task.description } : {}),
      ...(task.acceptanceCriteria ? { taskAcceptanceCriteria: task.acceptanceCriteria } : {}),
      taskSkills: task.skills.map(s => s.name),
      ...(task.project ? {
        projectName: task.project.name,
        projectTechStack: task.project.techStack,
        ...(task.project.architecture ? { projectArchitecture: task.project.architecture } : {}),
      } : {}),
      existingSubtaskTitles: existingSubtasks.map(t => t.title),
      availableSkillNames: skills.map(s => s.name),
      hint,
    });

    res.json(result);
  } catch (err) {
    logger.warn({ err, taskId: task.id }, 'LLM subtask generation failed');
    res.status(502).json({ error: 'AI subtask generation failed — try again later' });
  }
}));
```

- [ ] **Step 3: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/llmService.ts backend/src/routes/tasks.ts
git commit -m "feat: add generate-subtasks LLM function and POST /api/tasks/:id/generate-subtasks route

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend Types + API Functions

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TaskTree type**

Add at the end of `frontend/src/lib/types.ts`:

```typescript
export interface TaskTree {
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

- [ ] **Step 2: Add API functions**

Update the import at top of `frontend/src/lib/api.ts` to include `TaskTree`:

Add new functions at the end:

```typescript
// --- Task Detail ---

export const fetchTask = (id: string): Promise<TaskTree> =>
  fetch(`${API}/api/tasks/${id}`).then(r => handleResponse<TaskTree>(r));

export const deleteTask = (id: string): Promise<{ deleted: boolean }> =>
  fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' })
    .then(r => handleResponse<{ deleted: boolean }>(r));

export const generateSubtasks = (taskId: string, hint: string): Promise<{ tasks: GeneratedTask[] }> =>
  fetch(`${API}/api/tasks/${taskId}/generate-subtasks`, {
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
git commit -m "feat: add TaskTree type and API functions for task detail, delete, generate-subtasks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SubtaskTree Component

**Files:**
- Create: `frontend/src/components/SubtaskTree.tsx`

- [ ] **Step 1: Create the recursive SubtaskTree component**

```tsx
// frontend/src/components/SubtaskTree.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TaskTree } from '../lib/types';
import { deleteTask } from '../lib/api';

interface Props {
  subtasks: TaskTree[];
  depth?: number;
  onDeleted: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To-do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export default function SubtaskTree({ subtasks, depth = 0, onDeleted }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all its subtasks?`)) return;
    try {
      await deleteTask(id);
      onDeleted();
    } catch {
      alert('Failed to delete subtask');
    }
  };

  if (subtasks.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-3' : ''}>
      {subtasks.map(task => {
        const isCollapsed = collapsed.has(task.id);
        const hasChildren = task.subtasks.length > 0;

        return (
          <div key={task.id} className="py-1.5">
            <div className="flex items-center gap-2 group">
              {/* Expand/collapse */}
              <button onClick={() => toggleCollapse(task.id)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs flex-shrink-0">
                {hasChildren ? (isCollapsed ? '►' : '▼') : '·'}
              </button>

              {/* Title link */}
              <Link to={`/tasks/${task.id}`}
                className="flex-1 text-sm hover:text-blue-600 hover:underline truncate">
                {task.title}
              </Link>

              {/* Status badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[task.status] || ''}`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>

              {/* Story points */}
              {task.storyPoints && (
                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex-shrink-0">
                  {task.storyPoints} pts
                </span>
              )}

              {/* Delete button */}
              <button onClick={() => handleDelete(task.id, task.title)}
                className="text-gray-300 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Delete subtask">
                🗑
              </button>
            </div>

            {/* Recursive children */}
            {hasChildren && !isCollapsed && (
              <SubtaskTree subtasks={task.subtasks} depth={depth + 1} onDeleted={onDeleted} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SubtaskTree.tsx
git commit -m "feat: add SubtaskTree recursive component with expand/collapse and delete

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: TaskDetailPage

**Files:**
- Create: `frontend/src/pages/TaskDetailPage.tsx`

- [ ] **Step 1: Create the TaskDetailPage**

This is the largest component. It renders:
- Header: title, project link, status, assignee, story points dropdown, delete button
- Details: description, acceptance criteria, skills
- Subtask tree (using SubtaskTree component)
- Generate subtasks panel (hint input + generate button + results with checkboxes + add selected)

Key imports: `fetchTask`, `updateTask`, `deleteTask`, `generateSubtasks`, `createTask`, `fetchSkills` from api. `TaskTree`, `GeneratedTask`, `Skill` from types. `SubtaskTree` component. `FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const`.

The implementer should read the spec at `docs/superpowers/specs/2026-05-22-task-detail-subtask-management.md` sections "New Page: Task Detail" and "AI Generate Subtasks" for the full layout specification.

Key interactions:
- Story points dropdown: on change, call `updateTask(id, { storyPoints })` then reload
- Delete button: confirm dialog, then `deleteTask(id)`, navigate to `/projects/:projectId` or `/tasks`
- Generate subtasks: same pattern as ProjectDetailPage generate-tasks (hint input, generated cards with checkboxes, add selected creates tasks with `parentId`)
- Skill name→ID resolution for generated subtasks: call `fetchSkills()` to get skill list, map skillNames to IDs

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TaskDetailPage.tsx
git commit -m "feat: add TaskDetailPage with subtask tree, AI generation, and task deletion

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: App.tsx Routes — Add TaskDetail, Remove TaskCreatePage

**Files:**
- Modify: `frontend/src/App.tsx`
- Remove: `frontend/src/pages/TaskCreatePage.tsx`
- Remove: `frontend/src/components/TaskFormNode.tsx`
- Remove: `frontend/src/utils/treeUtils.ts`
- Remove: `frontend/src/__tests__/TaskCreatePage.test.tsx`
- Remove: `frontend/src/__tests__/TaskFormNode.test.tsx`
- Remove: `frontend/src/__tests__/treeUtils.test.ts`

- [ ] **Step 1: Update App.tsx**

Replace the content of `frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import NavBar from './components/NavBar';
import DashboardPage from './pages/DashboardPage';
import TaskListPage from './pages/TaskListPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DeveloperListPage from './pages/DeveloperListPage';
import DeveloperProfilePage from './pages/DeveloperProfilePage';
import AllocationPage from './pages/AllocationPage';

function DevRedirect() {
  const { id } = useParams();
  return <Navigate to={`/team/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/team" element={<DeveloperListPage />} />
        <Route path="/team/:id" element={<DeveloperProfilePage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/allocate" element={<AllocationPage />} />
        <Route path="/developers/:id" element={<DevRedirect />} />
        <Route path="/developers" element={<Navigate to="/team" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Delete old files**

```bash
rm frontend/src/pages/TaskCreatePage.tsx
rm frontend/src/components/TaskFormNode.tsx
rm frontend/src/utils/treeUtils.ts
rm frontend/src/__tests__/TaskCreatePage.test.tsx
rm frontend/src/__tests__/TaskFormNode.test.tsx
rm frontend/src/__tests__/treeUtils.test.ts
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

Note: If `treeUtils.ts` is imported elsewhere (e.g., `skillCategories.ts` or other files), those imports will fail. Check and remove any remaining imports of `treeUtils` or `TaskFormNode` or `TaskCreatePage`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add /tasks/:id route, remove /tasks/new and TaskCreatePage

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update ProjectDetailPage — Inline Task Creation + Task Title Links

**Files:**
- Modify: `frontend/src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Replace "+ Create Task" link with inline form**

In `frontend/src/pages/ProjectDetailPage.tsx`, find the `<Link to={...}>+ Create Task</Link>` at the bottom. Replace it with an inline form:

```tsx
{/* Inline Create Task */}
<div className="border rounded-lg p-4 mt-4">
  <h3 className="text-sm font-semibold mb-2">Create Task</h3>
  <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
    placeholder="Task title..." className="w-full border rounded px-3 py-1.5 text-sm mb-2" />
  <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)}
    placeholder="Description (optional)..." rows={2}
    className="w-full border rounded px-3 py-1.5 text-sm mb-2" />
  <button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || creatingTask}
    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
    {creatingTask ? 'Creating...' : 'Create'}
  </button>
</div>
```

Add state variables: `newTaskTitle`, `newTaskDesc`, `creatingTask`.

The handler calls `createTask({ title, description, skillIds: [], projectId: project.id })`, then clears the form and reloads tasks.

- [ ] **Step 2: Make task titles in the paginated list clickable**

In the task row rendering section, wrap the task title in a `<Link>`:

```tsx
<Link to={`/tasks/${task.id}`} className="hover:text-blue-600 hover:underline">
  {task.title}
</Link>
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectDetailPage.tsx
git commit -m "feat: inline task creation on ProjectDetailPage, clickable task titles

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Update TaskListPage + TaskRow

**Files:**
- Modify: `frontend/src/pages/TaskListPage.tsx`
- Modify: `frontend/src/components/TaskRow.tsx`

- [ ] **Step 1: Remove "Create Task" button from TaskListPage**

In `frontend/src/pages/TaskListPage.tsx`, find the "Create Task" link in the header and remove it. The header should just show the title "Tasks" without a creation button.

- [ ] **Step 2: Update TaskRow — change subtask link, add delete button**

In `frontend/src/components/TaskRow.tsx`:

1. Change the `+ Subtask` link from:
```tsx
<a href={`/tasks/new?parentId=${task.id}`} ...>+ Subtask</a>
```
To a link that navigates to the task's detail page:
```tsx
<Link to={`/tasks/${task.id}`} ...>View / Subtasks</Link>
```

2. Add a delete button in the actions cell:
```tsx
<button onClick={() => handleDelete()} className="text-red-400 hover:text-red-600 text-sm ml-2" title="Delete task">🗑</button>
```

The delete handler: confirm dialog, call `deleteTask(task.id)`, then `onUpdate()` to refresh.

Import `deleteTask` from `../lib/api` and `Link` from `react-router-dom`.

- [ ] **Step 3: Make task titles clickable in TaskRow**

Wrap the task title text in the first `<td>` with a Link:
```tsx
<Link to={`/tasks/${task.id}`} className="hover:text-blue-600 hover:underline">{task.title}</Link>
```

- [ ] **Step 4: Verify frontend compiles and run tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Fix any test failures (TaskRow tests may need `deleteTask` mock added, and the "Create Task" assertion in TaskListPage tests needs updating).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaskListPage.tsx frontend/src/components/TaskRow.tsx frontend/src/__tests__/
git commit -m "feat: clickable task titles, delete buttons on TaskRow, remove Create Task button

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final Verification

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
