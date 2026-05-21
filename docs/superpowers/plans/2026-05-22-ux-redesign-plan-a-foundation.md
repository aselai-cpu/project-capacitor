# UX Redesign Plan A: Foundation (Backend + Nav + Dashboard + Task Create + Team Rename)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the foundational backend endpoints, restructured navigation with badges, dashboard home page, AI-first task creation, and "Team" rename — everything needed before the Allocation page (Plan B).

**Architecture:** 4 new backend endpoints (dashboard metrics, allocation scores, allocation reasoning, skill classification preview) added as new route files. Frontend gets a new DashboardPage, restructured NavBar with badge counts, reformed TaskCreatePage with AI auto-classification and categorized skill groups, and route rename from /developers to /team.

**Tech Stack:** Express, Prisma, Zod, Vercel AI SDK (backend); React, React Router, Tailwind CSS (frontend); Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-05-22-ux-redesign-allocation-copilot.md`

---

## File Map

### Backend — New Files
- `backend/src/routes/dashboard.ts` — GET /api/dashboard endpoint
- `backend/src/routes/allocate.ts` — GET /api/allocate/scores + POST /api/allocate/reason
- `backend/src/services/dashboardService.ts` — aggregated metric queries
- `backend/src/services/allocationService.ts` — match scoring + LLM reasoning

### Backend — Modified Files
- `backend/src/index.ts` — mount new routers
- `backend/src/routes/tasks.ts` — add POST /api/tasks/classify-skills
- `backend/src/services/llmService.ts` — update classifySkills signature, add allocationReason function

### Frontend — New Files
- `frontend/src/pages/DashboardPage.tsx` — dashboard home page
- `frontend/src/lib/skillCategories.ts` — SKILL_CATEGORIES constant + helper functions
- `frontend/src/__tests__/DashboardPage.test.tsx` — dashboard tests

### Frontend — Modified Files
- `frontend/src/App.tsx` — new routes, /team rename, /dashboard default
- `frontend/src/components/NavBar.tsx` — reorder, badges, "Allocate" CTA
- `frontend/src/lib/api.ts` — new API functions (dashboard, classify-skills, scores)
- `frontend/src/lib/types.ts` — new interfaces (DashboardData, ScoreResponse, etc.)
- `frontend/src/pages/DeveloperListPage.tsx` — heading "Developers" → "Team"
- `frontend/src/pages/DeveloperProfilePage.tsx` — back link → /team
- `frontend/src/pages/TaskCreatePage.tsx` — AI-first skill classification
- `frontend/src/components/TaskFormNode.tsx` — categorized skill groups
- `frontend/src/pages/TaskListPage.tsx` — context-aware empty state
- `frontend/src/__tests__/TaskListPage.test.tsx` — update empty state assertion

---

## Task 1: Dashboard Backend Service

**Files:**
- Create: `backend/src/services/dashboardService.ts`

- [ ] **Step 1: Create the dashboard service**

```typescript
// backend/src/services/dashboardService.ts
import prisma from '../lib/prisma.js';

export interface DashboardData {
  activeProjects: number;
  unassignedTasks: number;
  teamMembers: number;
  inProgressTasks: number;
  projects: Array<{ id: string; name: string; unassignedCount: number }>;
  workload: Array<{ developerId: string; developerName: string; taskCount: number }>;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [unassignedTasks, inProgressTasks, teamMembers, allProjects, developers] = await Promise.all([
    prisma.task.count({ where: { developerId: null } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.developer.count(),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        tasks: { where: { developerId: null }, select: { id: true } },
      },
    }),
    prisma.developer.findMany({
      select: {
        id: true,
        name: true,
        tasks: { select: { id: true } },
      },
    }),
  ]);

  const projects = allProjects.map(p => ({
    id: p.id,
    name: p.name,
    unassignedCount: p.tasks.length,
  }));

  // Active = has at least 1 task in TODO or IN_PROGRESS
  const activeProjects = await prisma.project.count({
    where: {
      tasks: { some: { status: { in: ['TODO', 'IN_PROGRESS'] } } },
    },
  });

  const workload = developers.map(d => ({
    developerId: d.id,
    developerName: d.name,
    taskCount: d.tasks.length,
  }));

  return { activeProjects, unassignedTasks, teamMembers, inProgressTasks, projects, workload };
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/dashboardService.ts
git commit -m "feat: add dashboard service with aggregated metrics"
```

---

## Task 2: Dashboard Route

**Files:**
- Create: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create dashboard route**

```typescript
// backend/src/routes/dashboard.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getDashboardData } from '../services/dashboardService.js';

const router = Router();

router.get('/', asyncHandler(async (_, res) => {
  const data = await getDashboardData();
  res.json(data);
}));

export default router;
```

- [ ] **Step 2: Mount the route in index.ts**

In `backend/src/index.ts`, add import:
```typescript
import dashboardRouter from './routes/dashboard.js';
```

Add mount after the projects router (line 31):
```typescript
app.use('/api/dashboard', dashboardRouter);
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/dashboard.ts backend/src/index.ts
git commit -m "feat: add GET /api/dashboard endpoint"
```

---

## Task 3: Allocation Service — Match Scoring

**Files:**
- Create: `backend/src/services/allocationService.ts`

- [ ] **Step 1: Create the allocation service**

```typescript
// backend/src/services/allocationService.ts
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface TaskScore {
  developerId: string;
  developerName: string;
  matchPercent: number;
  missingSkills: string[];
  currentTaskCount: number;
  isTopPick: boolean;
}

export interface ScoredTask {
  taskId: string;
  taskTitle: string;
  taskSkills: string[];
  scores: TaskScore[];
}

export async function getUnassignedScores(projectId?: string): Promise<ScoredTask[]> {
  const where: Record<string, unknown> = { developerId: null };
  if (projectId) where.projectId = projectId;

  const [tasks, developers] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { skills: { select: { id: true, name: true } } },
    }),
    prisma.developer.findMany({
      include: {
        skills: { select: { id: true, name: true } },
        tasks: { select: { id: true } },
      },
    }),
  ]);

  return tasks.map(task => {
    const taskSkillIds = new Set(task.skills.map(s => s.id));
    const taskSkillNames = task.skills.map(s => s.name);

    const scores: TaskScore[] = developers.map(dev => {
      const devSkillIds = new Set(dev.skills.map(s => s.id));
      const devSkillNames = new Set(dev.skills.map(s => s.name));

      if (taskSkillIds.size === 0) {
        return {
          developerId: dev.id,
          developerName: dev.name,
          matchPercent: 100,
          missingSkills: [],
          currentTaskCount: dev.tasks.length,
          isTopPick: false,
        };
      }

      const overlapping = task.skills.filter(s => devSkillIds.has(s.id));
      const missing = task.skills.filter(s => !devSkillIds.has(s.id)).map(s => s.name);
      const matchPercent = Math.round((overlapping.length / taskSkillIds.size) * 100);

      return {
        developerId: dev.id,
        developerName: dev.name,
        matchPercent,
        missingSkills: missing,
        currentTaskCount: dev.tasks.length,
        isTopPick: false,
      };
    });

    // Determine top pick: highest matchPercent, ties broken by lowest task count
    scores.sort((a, b) => b.matchPercent - a.matchPercent || a.currentTaskCount - b.currentTaskCount);
    if (scores.length > 0 && scores[0].matchPercent > 0) {
      scores[0].isTopPick = true;
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskSkills: taskSkillNames,
      scores,
    };
  });
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/allocationService.ts
git commit -m "feat: add allocation service with deterministic skill match scoring"
```

---

## Task 4: Allocation Reason LLM Function

**Files:**
- Modify: `backend/src/services/llmService.ts`

- [ ] **Step 1: Add allocationReason function to llmService.ts**

Add at the end of `backend/src/services/llmService.ts` (after the `classifySkills` function):

```typescript
// --- Allocation reasoning ---

export async function generateAllocationReason(
  taskTitle: string,
  taskSkills: string[],
  developerName: string,
  developerSkills: string[],
  currentTaskCount: number,
): Promise<string> {
  try {
    const model = await getModel();
    const reasonSchema = z.object({
      reason: z.string(),
    });

    const { object } = await generateObject({
      model,
      schema: reasonSchema,
      prompt: `You are an AI assistant helping a project manager assign tasks to developers.

Task: "${taskTitle}"
Required skills: ${taskSkills.join(', ')}

Developer: ${developerName}
Developer skills: ${developerSkills.join(', ')}
Current workload: ${currentTaskCount} task(s)

Write a 1-2 sentence explanation of why this developer is a good fit for this task. Consider skill overlap and current workload. Be concise and specific.`,
      experimental_telemetry: {
        isEnabled: true,
        metadata: { feature: 'allocation-reason' },
      },
    });
    return object.reason;
  } catch (err) {
    logger.warn({ err, taskTitle, developerName }, 'LLM allocation reason failed');
    return 'AI reasoning unavailable.';
  }
}
```

- [ ] **Step 2: Update classifySkills to accept optional context**

In `backend/src/services/llmService.ts`, replace the `classifySkills` function signature and prompt:

Change line 256:
```typescript
export async function classifySkills(title: string, availableSkills?: string[]): Promise<string[]> {
```
to:
```typescript
export async function classifySkills(title: string, availableSkills?: string[], context?: string): Promise<string[]> {
```

Change the prompt (line 268) from:
```typescript
Task: "${title}"
```
to:
```typescript
Task: "${title}"${context ? `\nAdditional context: ${context}` : ''}
```

- [ ] **Step 3: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: No errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/llmService.ts
git commit -m "feat: add allocation reason LLM function, update classifySkills with optional context"
```

---

## Task 5: Allocate Routes + Classify-Skills Route

**Files:**
- Create: `backend/src/routes/allocate.ts`
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create allocate routes**

```typescript
// backend/src/routes/allocate.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getUnassignedScores } from '../services/allocationService.js';
import { generateAllocationReason } from '../services/llmService.js';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/allocate/scores — Match scores for unassigned tasks
router.get('/scores', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const scores = await getUnassignedScores(projectId);
  res.json(scores);
}));

// POST /api/allocate/reason — On-demand LLM reasoning for a task-developer pair
router.post('/reason', asyncHandler(async (req, res) => {
  const { taskId, developerId } = req.body as { taskId?: string; developerId?: string };
  if (!taskId || !developerId) {
    res.status(400).json({ error: 'taskId and developerId are required' });
    return;
  }

  const [task, developer] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, include: { skills: true } }),
    prisma.developer.findUnique({ where: { id: developerId }, include: { skills: true, tasks: { select: { id: true } } } }),
  ]);

  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  if (!developer) { res.status(404).json({ error: 'Developer not found' }); return; }

  const reason = await generateAllocationReason(
    task.title,
    task.skills.map(s => s.name),
    developer.name,
    developer.skills.map(s => s.name),
    developer.tasks.length,
  );

  res.json({ reason });
}));

export default router;
```

- [ ] **Step 2: Add POST /api/tasks/classify-skills to tasks route**

In `backend/src/routes/tasks.ts`, add import at top:
```typescript
import { classifySkills } from '../services/llmService.js';
import prisma from '../lib/prisma.js';
```

Note: `prisma` might already be imported via taskService. Check first — if `prisma` is not directly imported, add it. Also add `asyncHandler` import if not present.

Add before the `export default router;` line:

```typescript
// POST /api/tasks/classify-skills — AI skill classification preview
router.post('/classify-skills', asyncHandler(async (req, res) => {
  const { title, acceptanceCriteria } = req.body as { title?: string; acceptanceCriteria?: string };
  if (!title) { res.status(400).json({ error: 'title is required' }); return; }

  const skills = await prisma.skill.findMany();
  const availableSkillNames = skills.map(s => s.name);
  const skillMap = new Map(skills.map(s => [s.name, s.id]));

  const classified = await classifySkills(title, availableSkillNames, acceptanceCriteria);

  res.json({
    skillIds: classified.map(name => skillMap.get(name)).filter(Boolean),
    skillNames: classified,
  });
}));
```

- [ ] **Step 3: Mount allocate router in index.ts**

In `backend/src/index.ts`, add import:
```typescript
import allocateRouter from './routes/allocate.js';
```

Add mount:
```typescript
app.use('/api/allocate', allocateRouter);
```

- [ ] **Step 4: Verify backend compiles and tests pass**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: No errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/allocate.ts backend/src/routes/tasks.ts backend/src/index.ts
git commit -m "feat: add allocation scores/reason endpoints and classify-skills preview"
```

---

## Task 6: Frontend Types + API Functions

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add new types to types.ts**

Add at the end of `frontend/src/lib/types.ts`:

```typescript
export interface DashboardData {
  activeProjects: number;
  unassignedTasks: number;
  teamMembers: number;
  inProgressTasks: number;
  projects: Array<{ id: string; name: string; unassignedCount: number }>;
  workload: Array<{ developerId: string; developerName: string; taskCount: number }>;
}

export interface TaskScore {
  developerId: string;
  developerName: string;
  matchPercent: number;
  missingSkills: string[];
  currentTaskCount: number;
  isTopPick: boolean;
}

export interface ScoredTask {
  taskId: string;
  taskTitle: string;
  taskSkills: string[];
  scores: TaskScore[];
}

export interface ClassifyResult {
  skillIds: string[];
  skillNames: string[];
}
```

- [ ] **Step 2: Add new API functions to api.ts**

Add at the end of `frontend/src/lib/api.ts`:

```typescript
// --- Dashboard API ---

export const fetchDashboard = (): Promise<DashboardData> =>
  fetch(`${API}/api/dashboard`).then(r => handleResponse<DashboardData>(r));

// --- Allocation API ---

export const fetchAllocationScores = (projectId?: string): Promise<ScoredTask[]> => {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return fetch(`${API}/api/allocate/scores${qs}`).then(r => handleResponse<ScoredTask[]>(r));
};

export const fetchAllocationReason = (taskId: string, developerId: string): Promise<{ reason: string }> =>
  fetch(`${API}/api/allocate/reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, developerId }),
  }).then(r => handleResponse<{ reason: string }>(r));

// --- Skill Classification Preview ---

export const classifyTaskSkills = (title: string, acceptanceCriteria?: string): Promise<ClassifyResult> =>
  fetch(`${API}/api/tasks/classify-skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, acceptanceCriteria }),
  }).then(r => handleResponse<ClassifyResult>(r));
```

Add imports at top of api.ts (update the existing import line):
```typescript
import type { Task, Developer, Skill, Project, GeneratedStory, ExtractedSkill, DashboardData, ScoredTask, ClassifyResult } from './types';
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add frontend types and API functions for dashboard, allocation, classify"
```

---

## Task 7: Skill Categories Constant

**Files:**
- Create: `frontend/src/lib/skillCategories.ts`

- [ ] **Step 1: Create skill categories module**

```typescript
// frontend/src/lib/skillCategories.ts
import type { Skill } from './types';

export const SKILL_CATEGORIES: Record<string, string[]> = {
  'Languages': ['TypeScript', 'Python', 'Java', 'Go', 'Rust', 'JavaScript', 'SQL'],
  'Frameworks': ['React', 'Angular', 'Vue', 'Node.js', 'Flask', 'FastAPI', 'Spring Boot', 'React Native'],
  'Infrastructure': ['Docker', 'Kubernetes', 'AWS', 'AWS Lambda'],
  'Data': ['PostgreSQL', 'MongoDB', 'Redis', 'Neo4j', 'Elasticsearch'],
  'Tools': ['Git', 'GraphQL', 'Jest', 'JUnit', 'Cypress', 'Jira', 'Figma'],
  'AI/ML': ['LangChain', 'OpenAI API', 'Amazon Bedrock', 'Amazon Textract', 'OCR', 'RAG'],
};

export const NON_TECHNICAL_SKILLS = [
  'Communication', 'Collaboration', 'Pair Programming', 'Agile', 'TDD',
];

/** Group skills by category for display. Non-technical skills are excluded. Unknown skills go to "Other". */
export function groupSkillsByCategory(skills: Skill[]): Record<string, Skill[]> {
  const allCategorized = new Set(Object.values(SKILL_CATEGORIES).flat());
  const nonTech = new Set(NON_TECHNICAL_SKILLS);

  const groups: Record<string, Skill[]> = {};
  for (const [category, names] of Object.entries(SKILL_CATEGORIES)) {
    const matched = skills.filter(s => names.includes(s.name));
    if (matched.length > 0) groups[category] = matched;
  }

  const other = skills.filter(s => !allCategorized.has(s.name) && !nonTech.has(s.name));
  if (other.length > 0) groups['Other'] = other;

  return groups;
}

/** Filter out non-technical skills from a skill list (for task forms). */
export function filterTechnicalSkills(skills: Skill[]): Skill[] {
  const nonTech = new Set(NON_TECHNICAL_SKILLS);
  return skills.filter(s => !nonTech.has(s.name));
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/skillCategories.ts
git commit -m "feat: add skill categories constant with grouping and filtering helpers"
```

---

## Task 8: NavBar Restructure with Badges

**Files:**
- Modify: `frontend/src/components/NavBar.tsx`

- [ ] **Step 1: Rewrite NavBar with new navigation and badges**

Replace the entire content of `frontend/src/components/NavBar.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchDashboard } from '../lib/api';

export default function NavBar() {
  const { pathname } = useLocation();
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchDashboard()
      .then(data => setUnassignedCount(data.unassignedTasks))
      .catch(() => {});
  }, [pathname]); // refresh on every navigation

  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded text-sm ${pathname.startsWith(path) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <nav className="border-b px-6 py-3 flex gap-2 items-center bg-white">
      <Link to="/dashboard" className="font-bold text-lg mr-4">Capacitor</Link>
      <Link to="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
      <Link to="/team" className={linkClass('/team')}>Team</Link>
      <Link to="/projects" className={linkClass('/projects')}>Projects</Link>
      <Link to="/tasks" className={linkClass('/tasks')}>
        Tasks
        {unassignedCount > 0 && (
          <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
        )}
      </Link>
      <Link to="/allocate"
        className={`px-3 py-1.5 rounded text-sm font-semibold ${pathname.startsWith('/allocate') ? 'bg-purple-700 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        Allocate
        {unassignedCount > 0 && (
          <span className="ml-1.5 bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
        )}
      </Link>
    </nav>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NavBar.tsx
git commit -m "feat: restructure NavBar with workflow order, badges, and purple Allocate CTA"
```

---

## Task 9: App.tsx Routes + Team Rename

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DeveloperListPage.tsx`
- Modify: `frontend/src/pages/DeveloperProfilePage.tsx`

- [ ] **Step 1: Update App.tsx routes**

Replace the entire content of `frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import DashboardPage from './pages/DashboardPage';
import TaskListPage from './pages/TaskListPage';
import TaskCreatePage from './pages/TaskCreatePage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DeveloperListPage from './pages/DeveloperListPage';
import DeveloperProfilePage from './pages/DeveloperProfilePage';

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
        <Route path="/tasks/new" element={<TaskCreatePage />} />
        {/* Backward compatibility redirects */}
        <Route path="/developers/:id" element={<Navigate to="/team/:id" replace />} />
        <Route path="/developers" element={<Navigate to="/team" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Note: The `/developers/:id` redirect with `:id` doesn't automatically forward params in React Router v6. Use a small redirect component instead:

```tsx
// Inline in App.tsx — replace the /developers/:id route with:
import { useParams } from 'react-router-dom';

function DevRedirect() {
  const { id } = useParams();
  return <Navigate to={`/team/${id}`} replace />;
}

// Then in Routes:
<Route path="/developers/:id" element={<DevRedirect />} />
```

- [ ] **Step 2: Update DeveloperListPage heading**

In `frontend/src/pages/DeveloperListPage.tsx`, change the heading text from "Developers" to "Team". Also change the "Create Developer" button text to "Add Team Member".

Find:
```tsx
<h1 className="text-2xl font-bold">Developers</h1>
```
Replace with:
```tsx
<h1 className="text-2xl font-bold">Team</h1>
```

Find:
```tsx
{showForm ? 'Cancel' : 'Create Developer'}
```
Replace with:
```tsx
{showForm ? 'Cancel' : 'Add Team Member'}
```

- [ ] **Step 3: Update DeveloperProfilePage back link and delete navigation**

In `frontend/src/pages/DeveloperProfilePage.tsx`:

Change back link:
```tsx
<Link to="/developers" className="text-blue-600 text-sm hover:underline">← Back to Developers</Link>
```
to:
```tsx
<Link to="/team" className="text-blue-600 text-sm hover:underline">← Back to Team</Link>
```

Change delete navigation:
```tsx
navigate('/developers');
```
to:
```tsx
navigate('/team');
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/DeveloperListPage.tsx frontend/src/pages/DeveloperProfilePage.tsx
git commit -m "feat: restructure routes — /dashboard default, /team rename, backward-compat redirects"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/__tests__/DashboardPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';

vi.mock('../lib/api', () => ({
  fetchDashboard: vi.fn(),
}));

const mockDashboard = {
  activeProjects: 2,
  unassignedTasks: 5,
  teamMembers: 4,
  inProgressTasks: 3,
  projects: [
    { id: 'p1', name: 'Project Alpha', unassignedCount: 3 },
    { id: 'p2', name: 'E-Commerce', unassignedCount: 2 },
  ],
  workload: [
    { developerId: 'd1', developerName: 'Alice', taskCount: 3 },
    { developerId: 'd2', developerName: 'Bob', taskCount: 1 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders metric cards and allocation CTA', async () => {
    const { fetchDashboard } = await import('../lib/api');
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboard);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // active projects
      expect(screen.getByText('5')).toBeInTheDocument(); // unassigned
      expect(screen.getByText('4')).toBeInTheDocument(); // team members
      expect(screen.getByText('3')).toBeInTheDocument(); // in progress
      expect(screen.getByText(/tasks need developers/i)).toBeInTheDocument();
    });
  });

  it('shows project list with unassigned counts', async () => {
    const { fetchDashboard } = await import('../lib/api');
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboard);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx`
Expected: FAIL — DashboardPage doesn't exist yet

- [ ] **Step 3: Create DashboardPage**

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardData } from '../lib/types';
import { fetchDashboard } from '../lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!data) return <div className="max-w-6xl mx-auto p-6 text-red-600">Failed to load dashboard</div>;

  const maxTasks = Math.max(...data.workload.map(w => w.taskCount), 1);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Projects', value: data.activeProjects, color: 'text-blue-600' },
          { label: 'Unassigned Tasks', value: data.unassignedTasks, color: 'text-red-600' },
          { label: 'Team Members', value: data.teamMembers, color: 'text-green-600' },
          { label: 'In Progress', value: data.inProgressTasks, color: 'text-amber-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border rounded-xl p-5 text-center">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Allocation CTA */}
      {data.unassignedTasks > 0 && (
        <Link to="/allocate"
          className="block bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl px-6 py-4 mb-6 flex justify-between items-center">
          <div>
            <div className="text-white font-semibold">{data.unassignedTasks} tasks need developers</div>
            <div className="text-purple-200 text-sm">AI has pre-scored matches for your team</div>
          </div>
          <span className="bg-white text-purple-700 px-5 py-2 rounded-lg font-semibold text-sm">
            Start Allocating →
          </span>
        </Link>
      )}

      {/* Two-column: projects + workload */}
      <div className="grid grid-cols-2 gap-6">
        {/* Projects */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Projects</h2>
          {data.projects.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded">
              <span className="text-sm">{p.name}</span>
              {p.unassignedCount > 0 && (
                <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {p.unassignedCount} unassigned
                </span>
              )}
            </Link>
          ))}
          {data.projects.length === 0 && (
            <p className="text-gray-400 text-sm">No projects yet</p>
          )}
        </div>

        {/* Team workload */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Team Workload</h2>
          {data.workload.map(w => (
            <div key={w.developerId} className="flex items-center gap-3 py-1.5">
              <span className="text-sm w-16 truncate">{w.developerName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 rounded-full h-2 transition-all"
                  style={{ width: `${(w.taskCount / maxTasks) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">{w.taskCount} tasks</span>
            </div>
          ))}
          {data.workload.length === 0 && (
            <p className="text-gray-400 text-sm">No team members yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/__tests__/DashboardPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All pass (some existing tests may need `fetchDashboard` mock added if NavBar is rendered)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat: add DashboardPage with metrics, allocation CTA, and workload bars"
```

---

## Task 11: TaskCreatePage — AI-First Skill Classification

**Files:**
- Modify: `frontend/src/pages/TaskCreatePage.tsx`
- Modify: `frontend/src/components/TaskFormNode.tsx`

- [ ] **Step 1: Update TaskFormNode with categorized skills and AI classification display**

Replace `frontend/src/components/TaskFormNode.tsx`:

```tsx
import { useState } from 'react';
import type { TaskFormState, Skill } from '../lib/types';
import { createEmptyNode } from '../utils/treeUtils';
import { groupSkillsByCategory, filterTechnicalSkills } from '../lib/skillCategories';

interface Props {
  node: TaskFormState;
  skills: Skill[];
  depth: number;
  onUpdate: (id: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => void;
  classifiedSkillIds?: string[];
  classifying?: boolean;
  onTitleBlur?: () => void;
}

export default function TaskFormNode({ node, skills, depth, onUpdate, classifiedSkillIds, classifying, onTitleBlur }: Props) {
  const [showManual, setShowManual] = useState(false);
  const technicalSkills = filterTechnicalSkills(skills);
  const grouped = groupSkillsByCategory(technicalSkills);
  const hasAiSkills = classifiedSkillIds && classifiedSkillIds.length > 0;

  return (
    <div className="border-l-2 border-gray-200 pl-4 my-2" style={{ marginLeft: `${depth * 16}px` }}>
      <input
        aria-label="Task title"
        type="text"
        value={node.title}
        onChange={e => onUpdate(node.id, () => ({ title: e.target.value }))}
        onBlur={onTitleBlur}
        placeholder="Task title..."
        className="w-full border rounded px-3 py-1.5 text-sm mb-2"
      />

      {/* AI classification result */}
      {classifying && (
        <div className="text-xs text-purple-600 mb-2">Classifying skills...</div>
      )}
      {hasAiSkills && !classifying && (
        <div className="bg-green-50 border border-green-200 rounded px-3 py-2 mb-2">
          <span className="text-xs text-green-700 font-medium">AI classified: </span>
          {classifiedSkillIds.map(id => {
            const skill = skills.find(s => s.id === id);
            return skill ? (
              <span key={id} className="inline-block bg-green-500 text-white text-xs px-2 py-0.5 rounded mr-1">{skill.name}</span>
            ) : null;
          })}
        </div>
      )}

      {/* Manual override toggle */}
      <div className="mb-2">
        <button type="button" onClick={() => setShowManual(!showManual)}
          className="text-xs text-gray-500 hover:text-gray-700">
          {showManual ? 'Hide manual skills ▾' : 'Refine skills manually ▸'}
        </button>
      </div>

      {showManual && (
        <div className="bg-gray-50 rounded p-3 mb-2">
          {Object.entries(grouped).map(([category, catSkills]) => (
            <div key={category} className="mb-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{category}</div>
              <div className="flex flex-wrap gap-1">
                {catSkills.map(skill => {
                  const active = node.skillIds.includes(skill.id);
                  return (
                    <button key={skill.id} type="button" aria-pressed={active}
                      aria-label={`Toggle ${skill.name} skill`}
                      onClick={() => onUpdate(node.id, n => ({
                        skillIds: active ? n.skillIds.filter(id => id !== skill.id) : [...n.skillIds, skill.id],
                      }))}
                      className={`px-2 py-0.5 text-xs rounded-full border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {skill.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button"
        onClick={() => onUpdate(node.id, n => ({ subtasks: [...n.subtasks, createEmptyNode()] }))}
        className="text-xs bg-gray-800 text-white px-2 py-1 rounded">
        + Subtask
      </button>

      {node.subtasks.map(child => (
        <TaskFormNode key={child.id} node={child} skills={skills} depth={depth + 1} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update TaskCreatePage with AI auto-classification**

Replace `frontend/src/pages/TaskCreatePage.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Skill, TaskFormState } from '../lib/types';
import { fetchSkills, createTask, classifyTaskSkills } from '../lib/api';
import TaskFormNode from '../components/TaskFormNode';
import { updateNodeInTree, createEmptyNode } from '../utils/treeUtils';

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId');

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [rootTask, setRootTask] = useState<TaskFormState>(createEmptyNode());
  const [saving, setSaving] = useState(false);

  // AI classification state
  const [classifiedSkillIds, setClassifiedSkillIds] = useState<string[]>([]);
  const [classifying, setClassifying] = useState(false);
  const classifyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {})
      .finally(() => setSkillsLoading(false));
  }, []);

  const handleClassify = useCallback(async () => {
    const title = rootTask.title.trim();
    if (!title || title.length < 5) return;

    setClassifying(true);
    try {
      const result = await classifyTaskSkills(title);
      setClassifiedSkillIds(result.skillIds);
      // Auto-select classified skills if user hasn't manually selected any
      if (rootTask.skillIds.length === 0 && result.skillIds.length > 0) {
        setRootTask(prev => ({ ...prev, skillIds: result.skillIds }));
      }
    } catch {
      // Fail silently — manual selection still works
    } finally {
      setClassifying(false);
    }
  }, [rootTask.title, rootTask.skillIds.length]);

  const handleTitleBlur = useCallback(() => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    classifyTimer.current = setTimeout(handleClassify, 300);
  }, [handleClassify]);

  const handleUpdate = (targetId: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => {
    setRootTask(prev => updateNodeInTree(prev, targetId, updater));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTask({
        title: rootTask.title,
        skillIds: rootTask.skillIds,
        parentId: parentId,
        subtasks: parentId ? [] : rootTask.subtasks,
      });
      navigate('/tasks');
    } catch {
      alert('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {parentId ? 'Add Subtask' : 'Create Task'}
      </h1>
      {skillsLoading && <p className="text-gray-400 text-sm mb-2">Loading skills...</p>}
      <form onSubmit={handleSubmit}>
        <TaskFormNode
          node={rootTask}
          skills={skills}
          depth={0}
          onUpdate={handleUpdate}
          classifiedSkillIds={classifiedSkillIds}
          classifying={classifying}
          onTitleBlur={handleTitleBlur}
        />
        <div className="flex justify-end mt-4 pt-4 border-t">
          <button type="submit" disabled={saving || !rootTask.title}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass. Some TaskFormNode/TaskCreatePage tests may need updating — add `classifiedSkillIds`, `classifying`, `onTitleBlur` props to any test that renders TaskFormNode directly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaskCreatePage.tsx frontend/src/components/TaskFormNode.tsx
git commit -m "feat: AI-first skill classification with categorized manual override on task creation"
```

---

## Task 12: TaskListPage Empty State Fix

**Files:**
- Modify: `frontend/src/pages/TaskListPage.tsx`

- [ ] **Step 1: Update the empty state text**

In `frontend/src/pages/TaskListPage.tsx`, find:
```tsx
{tasks.length === 0 && <p className="text-gray-500 mt-4">No tasks match the current filters.</p>}
```

Replace with:
```tsx
{tasks.length === 0 && (
  <p className="text-gray-500 mt-4">
    {projectId || status || developerId
      ? 'No tasks match the current filters.'
      : 'No tasks yet. Create one to get started.'}
  </p>
)}
```

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TaskListPage.tsx
git commit -m "fix: context-aware empty state text on TaskListPage"
```

---

## Task 13: Update Existing Tests

**Files:**
- Modify: `frontend/src/__tests__/TaskListPage.test.tsx`
- Modify: `frontend/src/__tests__/TaskRow.test.tsx`
- Modify: `frontend/src/__tests__/TaskCreatePage.test.tsx`
- Modify: `frontend/src/__tests__/TaskFormNode.test.tsx`

- [ ] **Step 1: Update all test mocks that render NavBar**

Any test that renders a page component inside `<MemoryRouter>` and indirectly renders NavBar will now need `fetchDashboard` mocked. Check each test file — if the test uses `<MemoryRouter>` with a full page component that includes NavBar, add to the mock:

```typescript
fetchDashboard: vi.fn(() => Promise.resolve({
  activeProjects: 0, unassignedTasks: 0, teamMembers: 0, inProgressTasks: 0,
  projects: [], workload: [],
})),
```

Note: Most page tests render the page component directly (not wrapped in App), so NavBar is NOT rendered. Only update tests that actually fail.

- [ ] **Step 2: Update TaskFormNode tests for new props**

In `frontend/src/__tests__/TaskFormNode.test.tsx`, add the new optional props to test renders:

```tsx
<TaskFormNode node={...} skills={...} depth={0} onUpdate={...} classifiedSkillIds={[]} classifying={false} onTitleBlur={() => {}} />
```

- [ ] **Step 3: Update TaskCreatePage tests for new API mock**

In `frontend/src/__tests__/TaskCreatePage.test.tsx`, add `classifyTaskSkills` to the mock:

```typescript
classifyTaskSkills: vi.fn(() => Promise.resolve({ skillIds: [], skillNames: [] })),
```

- [ ] **Step 4: Run all tests**

Run: `cd frontend && npx vitest run && cd ../backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/__tests__/
git commit -m "test: update existing tests for NavBar badges, TaskFormNode props, and classify mock"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: TypeScript compile check**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build check**

Run: `cd backend && npm run build && cd ../frontend && npm run build`
Expected: Clean builds
