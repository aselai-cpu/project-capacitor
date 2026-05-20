# Task Assignment App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Task Assignment app with skill-constrained assignment, recursive subtasks, and LLM skill classification.

**Architecture:** Monorepo with `backend/` (Express + Prisma) and `frontend/` (Vite + React). PostgreSQL in Docker. REST API between them. LLM enrichment via Vercel AI SDK on task creation.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL, React 19, Vite, React Router v7, Tailwind CSS, Vercel AI SDK, Zod, Docker

**Spec:** `docs/superpowers/specs/2026-05-21-task-assignment-app-design.md`

---

### Task 1: Project scaffolding and Prisma schema

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/lib/prisma.ts`
- Create: `docker-compose.yml`
- Create: `.env`
- Create: `.gitignore`

- [ ] **Step 1: Initialize backend project**

```bash
mkdir -p backend && cd backend
npm init -y
npm install express cors prisma @prisma/client zod
npm install -D typescript @types/express @types/cors @types/node ts-node
npx tsc --init --rootDir src --outDir dist --strict --esModuleInterop --resolveJsonModule
npx prisma init
```

- [ ] **Step 2: Write docker-compose.yml at project root**

Copy the docker-compose `db` service from the spec (lines 468-500). Only the database for now — backend and frontend services added in Task 10.

```yaml
# docker-compose.yml (project root)
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

volumes:
  pgdata:
```

- [ ] **Step 3: Create .env at project root**

```
DATABASE_URL=postgresql://user:password@localhost:5432/capacitor
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

- [ ] **Step 4: Write Prisma schema**

Copy exact schema from spec lines 46-95 into `backend/prisma/schema.prisma`.

- [ ] **Step 5: Write Prisma client singleton**

```typescript
// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export default prisma;
```

- [ ] **Step 6: Start DB, push schema, verify**

```bash
docker-compose up -d db
cd backend && npx prisma db push
npx prisma studio  # verify tables exist in browser
```

- [ ] **Step 7: Create .gitignore and commit**

```gitignore
node_modules/
dist/
.env
*.log
```

```bash
git add -A && git commit -m "feat: scaffold backend with Prisma schema and PostgreSQL

Initialize backend project with Express, Prisma, TypeScript.
Prisma schema defines Developer, Skill, Task entities with
self-referencing subtasks and implicit M:N relationships.
docker-compose runs PostgreSQL 15."
```

---

### Task 2: Seed script

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (add prisma.seed config)

- [ ] **Step 1: Write seed script**

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Upsert skills (idempotent)
  const frontend = await prisma.skill.upsert({
    where: { name: 'Frontend' },
    update: {},
    create: { name: 'Frontend' },
  });
  const backend = await prisma.skill.upsert({
    where: { name: 'Backend' },
    update: {},
    create: { name: 'Backend' },
  });

  // Seed developers with skills
  const devs = [
    { name: 'Alice', skills: [frontend.id] },
    { name: 'Bob', skills: [backend.id] },
    { name: 'Carol', skills: [frontend.id, backend.id] },
    { name: 'Dave', skills: [backend.id] },
  ];

  for (const dev of devs) {
    await prisma.developer.upsert({
      where: { id: dev.name.toLowerCase() }, // won't match UUID, creates new
      update: {},
      create: {
        name: dev.name,
        skills: { connect: dev.skills.map(id => ({ id })) },
      },
    });
  }

  console.log('Seed complete: 2 skills, 4 developers');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Note: Upsert on developer won't match by UUID on restarts. Use `connectOrCreate` pattern or delete-then-create for true idempotency:

```typescript
// Alternative idempotent approach:
await prisma.developer.deleteMany();
await prisma.skill.deleteMany();
// Then create fresh
```

- [ ] **Step 2: Add prisma seed config to package.json**

```json
{
  "prisma": {
    "seed": "npx ts-node prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Run seed and verify**

```bash
cd backend && npx prisma db seed
npx prisma studio  # verify 2 skills, 4 developers with correct skill assignments
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat: add idempotent seed script for developers and skills"
```

---

### Task 3: Express app with health check and CORS

**Files:**
- Create: `backend/src/index.ts`

- [ ] **Step 1: Write Express app entry point**

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

export default app;
```

- [ ] **Step 2: Add build and start scripts to package.json**

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "npx ts-node src/index.ts",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 3: Run and verify**

```bash
cd backend && npm run dev
# In another terminal:
curl http://localhost:5000/api/health
# Expected: {"status":"ok"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts backend/package.json
git commit -m "feat: Express app with health check, CORS, JSON parser"
```

---

### Task 4: Zod validation middleware + API types

**Files:**
- Create: `backend/src/middleware/validate.ts`
- Create: `backend/src/types.ts`

- [ ] **Step 1: Write validation middleware**

```typescript
// backend/src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 2: Write shared types and Zod schemas**

```typescript
// backend/src/types.ts
import { z } from 'zod';

export interface CreateTaskInput {
  title: string;
  skillIds: string[];
  parentId: string | null;
  subtasks: CreateTaskInput[];
}

export const createTaskSchema: z.ZodType<CreateTaskInput> = z.object({
  title: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional().default([]),
  parentId: z.string().uuid().nullable().optional().default(null),
  subtasks: z.lazy(() => z.array(createTaskSchema)).optional().default([]),
});

export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  developerId: z.string().uuid().nullable().optional(),
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/middleware/ backend/src/types.ts
git commit -m "feat: Zod validation middleware and API type definitions"
```

---

### Task 5: Skills and Developers read routes

**Files:**
- Create: `backend/src/routes/skills.ts`
- Create: `backend/src/routes/developers.ts`
- Modify: `backend/src/index.ts` (mount routes)

- [ ] **Step 1: Write skills route**

```typescript
// backend/src/routes/skills.ts
import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_, res) => {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
  });
  res.json(skills);
});

export default router;
```

- [ ] **Step 2: Write developers routes**

```typescript
// backend/src/routes/developers.ts
import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_, res) => {
  const developers = await prisma.developer.findMany({
    include: { skills: { select: { id: true, name: true } } },
  });
  res.json(developers);
});

router.get('/:id', async (req, res) => {
  const developer = await prisma.developer.findUnique({
    where: { id: req.params.id },
    include: { skills: { select: { id: true, name: true } } },
  });
  if (!developer) return res.status(404).json({ error: 'Developer not found' });
  res.json(developer);
});

export default router;
```

- [ ] **Step 3: Mount routes in index.ts**

Add to `backend/src/index.ts`:

```typescript
import skillsRouter from './routes/skills';
import developersRouter from './routes/developers';

app.use('/api/skills', skillsRouter);
app.use('/api/developers', developersRouter);
```

- [ ] **Step 4: Test manually**

```bash
npm run dev
curl http://localhost:5000/api/skills
curl http://localhost:5000/api/developers
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/ backend/src/index.ts
git commit -m "feat: GET /api/skills and GET /api/developers endpoints"
```

---

### Task 6: Task service with business logic

**Files:**
- Create: `backend/src/services/taskService.ts`

This is the core business logic: flat list with depth, recursive tree build, create with Prisma nested writes, and invariant guards.

- [ ] **Step 1: Write taskService.ts**

```typescript
// backend/src/services/taskService.ts
import prisma from '../lib/prisma';
import { CreateTaskInput } from '../types';
import { Task, Prisma, TaskStatus } from '@prisma/client';

const taskInclude = {
  skills: { select: { id: true, name: true } },
  developer: { select: { id: true, name: true } },
};

// --- GET /api/tasks (flat list with depth) ---
export async function getAllTasksFlat() {
  const tasks = await prisma.task.findMany({ include: taskInclude });
  return computeFlatListWithDepth(tasks);
}

function computeFlatListWithDepth(tasks: any[]) {
  const childrenMap = new Map<string | null, any[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(task);
  }
  // Sort siblings by createdAt
  for (const children of childrenMap.values()) {
    children.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  const result: any[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const child of childrenMap.get(parentId) ?? []) {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

// --- GET /api/tasks/:id (recursive tree) ---
export async function getTaskById(id: string) {
  const tasks = await prisma.task.findMany({ include: taskInclude });
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  return buildTree(task, tasks);
}

function buildTree(task: any, allTasks: any[]): any {
  const children = allTasks.filter(t => t.parentId === task.id);
  return {
    ...task,
    subtasks: children.map(c => buildTree(c, allTasks)),
  };
}

// --- POST /api/tasks (create tree) ---
export async function createTask(input: CreateTaskInput) {
  const prismaData = toPrismaCreate(input);

  const created = await prisma.task.create({
    data: prismaData as any,
    include: taskInclude,
  });

  // Re-fetch as tree for response
  return getTaskById(created.id);
}

function toPrismaCreate(node: CreateTaskInput): any {
  return {
    title: node.title,
    parentId: node.parentId,
    skills: node.skillIds.length > 0
      ? { connect: node.skillIds.map(id => ({ id })) }
      : undefined,
    subtasks: node.subtasks.length > 0
      ? { create: node.subtasks.map(child => toPrismaCreate(child)) }
      : undefined,
  };
}

// --- PATCH /api/tasks/:id (update with guards) ---
export async function updateTask(id: string, data: { status?: string; developerId?: string | null }) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { skills: true, subtasks: true },
  });
  if (!task) return { error: 'Task not found', status: 404 };

  // Invariant B: cascade guard on DONE
  if (data.status === 'DONE') {
    const pendingSubtasks = task.subtasks.filter(s => s.status !== 'DONE');
    if (pendingSubtasks.length > 0) {
      return {
        error: 'Cannot mark as done: subtasks not completed',
        pending_subtasks: pendingSubtasks.map(s => ({ id: s.id, title: s.title, status: s.status })),
        status: 400,
      };
    }
  }

  // Invariant A: skill superset guard on assignment
  if (data.developerId) {
    const developer = await prisma.developer.findUnique({
      where: { id: data.developerId },
      include: { skills: true },
    });
    if (!developer) return { error: 'Developer not found', status: 404 };

    const devSkillIds = new Set(developer.skills.map(s => s.id));
    const taskSkillIds = task.skills.map(s => s.id);
    const missing = taskSkillIds.filter(id => !devSkillIds.has(id));
    if (missing.length > 0) {
      return {
        error: 'Developer lacks required skills',
        required: task.skills.map(s => s.name),
        developer_skills: developer.skills.map(s => s.name),
        status: 422,
      };
    }
  }

  const updateData: any = {};
  if (data.status) updateData.status = data.status as TaskStatus;
  if (data.developerId !== undefined) updateData.developerId = data.developerId;

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: taskInclude,
  });
  return { data: updated, status: 200 };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/taskService.ts
git commit -m "feat: task service with flat list, tree build, create, and invariant guards"
```

---

### Task 7: Task routes

**Files:**
- Create: `backend/src/routes/tasks.ts`
- Modify: `backend/src/index.ts` (mount route)

- [ ] **Step 1: Write task routes**

```typescript
// backend/src/routes/tasks.ts
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema } from '../types';
import * as taskService from '../services/taskService';

const router = Router();

router.get('/', async (_, res) => {
  const tasks = await taskService.getAllTasksFlat();
  res.json(tasks);
});

router.get('/:id', async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/', validate(createTaskSchema), async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validate(updateTaskSchema), async (req, res) => {
  const result = await taskService.updateTask(req.params.id, req.body);
  if ('error' in result) {
    return res.status(result.status).json(result);
  }
  res.json(result.data);
});

export default router;
```

- [ ] **Step 2: Mount in index.ts**

```typescript
import tasksRouter from './routes/tasks';
app.use('/api/tasks', tasksRouter);
```

- [ ] **Step 3: Test all endpoints manually**

```bash
npm run dev

# List tasks (empty)
curl http://localhost:5000/api/tasks

# Create a task
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Build homepage","skillIds":[]}'

# List tasks (should show 1 task)
curl http://localhost:5000/api/tasks

# Get skills to find frontend ID, then test assignment guard
curl http://localhost:5000/api/developers
# Try assigning Bob (Backend only) to a Frontend task → should 422
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/index.ts
git commit -m "feat: task CRUD routes with invariant A + B guards"
```

---

### Task 8: Frontend scaffolding

**Files:**
- Create: `frontend/` (Vite scaffold)
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`

- [ ] **Step 1: Scaffold Vite + React + TypeScript**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind**

Add to `frontend/vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Add to `frontend/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 3: Write API client and types**

```typescript
// frontend/src/lib/types.ts
export interface Skill {
  id: string;
  name: string;
}

export interface Developer {
  id: string;
  name: string;
  skills: Skill[];
}

export interface Task {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  parentId: string | null;
  depth: number;
  skills: Skill[];
  developer: Developer | null;
  createdAt: string;
}

export interface TaskFormState {
  id: string;
  title: string;
  skillIds: string[];
  subtasks: TaskFormState[];
}
```

```typescript
// frontend/src/lib/api.ts
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const fetchTasks = (): Promise<Task[]> =>
  fetch(`${API}/api/tasks`).then(r => r.json());

export const fetchDevelopers = (): Promise<Developer[]> =>
  fetch(`${API}/api/developers`).then(r => r.json());

export const fetchSkills = (): Promise<Skill[]> =>
  fetch(`${API}/api/skills`).then(r => r.json());

export const createTask = (body: any): Promise<any> =>
  fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

export const updateTask = (id: string, body: any): Promise<any> =>
  fetch(`${API}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

import { Task, Developer, Skill } from './types';
```

- [ ] **Step 4: Set up React Router in App.tsx**

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TaskListPage from './pages/TaskListPage';
import TaskCreatePage from './pages/TaskCreatePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/new" element={<TaskCreatePage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React Router, Tailwind, API client"
```

---

### Task 9: Task List page and Task Create page

**Files:**
- Create: `frontend/src/pages/TaskListPage.tsx`
- Create: `frontend/src/pages/TaskCreatePage.tsx`
- Create: `frontend/src/components/TaskRow.tsx`
- Create: `frontend/src/components/TaskFormNode.tsx`
- Create: `frontend/src/utils/treeUtils.ts`

This is the largest frontend task. Both pages in one task since they share types and API client.

- [ ] **Step 1: Write treeUtils.ts**

```typescript
// frontend/src/utils/treeUtils.ts
import { TaskFormState } from '../lib/types';

export function createEmptyNode(): TaskFormState {
  return { id: crypto.randomUUID(), title: '', skillIds: [], subtasks: [] };
}

export function updateNodeInTree(
  node: TaskFormState,
  targetId: string,
  updater: (n: TaskFormState) => Partial<TaskFormState>
): TaskFormState {
  if (node.id === targetId) return { ...node, ...updater(node) };
  return {
    ...node,
    subtasks: node.subtasks.map(child => updateNodeInTree(child, targetId, updater)),
  };
}
```

- [ ] **Step 2: Write TaskRow component**

```typescript
// frontend/src/components/TaskRow.tsx
import { Task, Developer } from '../lib/types';
import { updateTask } from '../lib/api';

interface Props {
  task: Task;
  developers: Developer[];
  onUpdate: () => void;
}

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export default function TaskRow({ task, developers, onUpdate }: Props) {
  // Filter developers who have ALL required skills
  const eligibleDevs = developers.filter(dev => {
    const devSkillIds = new Set(dev.skills.map(s => s.id));
    return task.skills.every(s => devSkillIds.has(s.id));
  });

  const handleStatusChange = async (status: string) => {
    await updateTask(task.id, { status });
    onUpdate();
  };

  const handleAssigneeChange = async (developerId: string) => {
    await updateTask(task.id, { developerId: developerId || null });
    onUpdate();
  };

  return (
    <tr>
      <td style={{ paddingLeft: `${task.depth * 24}px` }} className="py-2 pr-4">
        {task.depth > 0 && <span className="text-gray-400 mr-1">↳</span>}
        {task.title}
      </td>
      <td className="py-2 pr-4">
        {task.skills.map(s => (
          <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">
            {s.name}
          </span>
        ))}
      </td>
      <td className="py-2 pr-4">
        <select value={task.status} onChange={e => handleStatusChange(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </td>
      <td className="py-2 pr-4">
        <select value={task.developer?.id || ''} onChange={e => handleAssigneeChange(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          <option value="">Unassigned</option>
          {eligibleDevs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </td>
      <td className="py-2">
        <a href={`/tasks/new?parentId=${task.id}`} className="text-blue-600 text-sm hover:underline">
          + Subtask
        </a>
      </td>
    </tr>
  );
}
```

- [ ] **Step 3: Write TaskListPage**

```typescript
// frontend/src/pages/TaskListPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Task, Developer } from '../lib/types';
import { fetchTasks, fetchDevelopers } from '../lib/api';
import TaskRow from '../components/TaskRow';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);

  const loadData = () => {
    fetchTasks().then(setTasks);
    fetchDevelopers().then(setDevelopers);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link to="/tasks/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Task
        </Link>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b font-semibold text-sm text-gray-600">
            <th className="py-2 pr-4">Task Title</th>
            <th className="py-2 pr-4">Skills</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Assignee</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} developers={developers} onUpdate={loadData} />
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p className="text-gray-500 mt-4">No tasks yet. Create one to get started.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Write TaskFormNode (recursive)**

```typescript
// frontend/src/components/TaskFormNode.tsx
import { TaskFormState, Skill } from '../lib/types';

interface Props {
  node: TaskFormState;
  skills: Skill[];
  depth: number;
  onUpdate: (id: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => void;
}

export default function TaskFormNode({ node, skills, depth, onUpdate }: Props) {
  return (
    <div className="border-l-2 border-gray-200 pl-4 my-2" style={{ marginLeft: `${depth * 16}px` }}>
      <div className="flex gap-2 items-center mb-2">
        <input
          type="text"
          value={node.title}
          onChange={e => onUpdate(node.id, () => ({ title: e.target.value }))}
          placeholder="Task title..."
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        {skills.map(skill => {
          const active = node.skillIds.includes(skill.id);
          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => onUpdate(node.id, n => ({
                skillIds: active ? n.skillIds.filter(id => id !== skill.id) : [...n.skillIds, skill.id],
              }))}
              className={`px-2 py-1 text-xs rounded ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {skill.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onUpdate(node.id, n => ({
            subtasks: [...n.subtasks, { id: crypto.randomUUID(), title: '', skillIds: [], subtasks: [] }],
          }))}
          className="text-xs bg-gray-800 text-white px-2 py-1 rounded"
        >
          + Subtask
        </button>
      </div>
      {node.subtasks.map(child => (
        <TaskFormNode key={child.id} node={child} skills={skills} depth={depth + 1} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write TaskCreatePage**

```typescript
// frontend/src/pages/TaskCreatePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Skill, TaskFormState } from '../lib/types';
import { fetchSkills, createTask } from '../lib/api';
import TaskFormNode from '../components/TaskFormNode';
import { updateNodeInTree, createEmptyNode } from '../utils/treeUtils';

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId');

  const [skills, setSkills] = useState<Skill[]>([]);
  const [rootTask, setRootTask] = useState<TaskFormState>(createEmptyNode());
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSkills().then(setSkills); }, []);

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
        subtasks: parentId ? [] : rootTask.subtasks, // No nested subtasks in parentId mode
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
      <form onSubmit={handleSubmit}>
        <TaskFormNode node={rootTask} skills={skills} depth={0} onUpdate={handleUpdate} />
        <div className="flex justify-end mt-4 pt-4 border-t">
          <button
            type="submit"
            disabled={saving || !rootTask.title}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verify frontend runs**

```bash
cd frontend && npm run dev
# Open http://localhost:5173 — should redirect to /tasks
# With backend running, create a task, verify it appears in list
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: Task List and Task Create pages with recursive subtask form

Task List: flat table with depth indent, status/assignee dropdowns,
skill badges, Add Subtask link per row.
Task Create: recursive TaskFormNode with skill toggles and dynamic
subtask addition. Supports parentId from URL for subtask mode."
```

---

### Task 10: LLM skill classification service

**Files:**
- Create: `backend/src/services/llmService.ts`
- Modify: `backend/src/services/taskService.ts` (integrate enrichment)

- [ ] **Step 1: Install Vercel AI SDK**

```bash
cd backend && npm install ai @ai-sdk/google
```

- [ ] **Step 2: Write LLM service**

Copy `classifySkills()` from spec lines 407-428 into `backend/src/services/llmService.ts`.

- [ ] **Step 3: Add enrichment to taskService.createTask()**

Before `toPrismaCreate()`, add:

```typescript
import { classifySkills } from './llmService';

// In createTask():
// 1. Get skill name→id map
const skills = await prisma.skill.findMany();
const skillMap = new Map(skills.map(s => [s.name, s.id]));

// 2. Collect nodes needing classification
const needsSkills: CreateTaskInput[] = [];
function collectEmpty(node: CreateTaskInput) {
  if (node.skillIds.length === 0) needsSkills.push(node);
  node.subtasks.forEach(collectEmpty);
}
collectEmpty(input);

// 3. Classify in parallel with timeout
if (needsSkills.length > 0) {
  try {
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej('timeout'), 5000));
    const results = await Promise.race([
      Promise.allSettled(needsSkills.map(n => classifySkills(n.title))),
      timeout,
    ]);
    (results as PromiseSettledResult<string[]>[]).forEach((r, i) => {
      if (r.status === 'fulfilled') {
        needsSkills[i].skillIds = r.value.map(name => skillMap.get(name)).filter(Boolean) as string[];
      }
    });
  } catch { /* timeout — fail-open */ }
}
```

- [ ] **Step 4: Test with and without API key**

```bash
# With key: create task without skills → skills should be auto-populated
# Without key: should still create task with empty skills (fail-open)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/
git commit -m "feat: LLM skill classification with parallel enrichment and fail-open

Uses Vercel AI SDK + Gemini 2.5 Flash. Classifies skill-less tasks
in parallel via Promise.allSettled with 5s batch timeout."
```

---

### Task 11: Dockerfiles and full docker-compose

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml` (add backend + frontend services)

- [ ] **Step 1: Write backend Dockerfile**

Copy from spec/final-decisions:
```dockerfile
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

- [ ] **Step 2: Write frontend Dockerfile**

```dockerfile
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

- [ ] **Step 3: Add backend + frontend to docker-compose.yml**

Add the `backend` and `frontend` services from spec lines 484-496.

- [ ] **Step 4: Add .dockerignore files**

```
# backend/.dockerignore and frontend/.dockerignore
node_modules
dist
.env
```

- [ ] **Step 5: Test full stack**

```bash
docker-compose down -v  # clean start
docker-compose up --build
# Open http://localhost:3000 — full app should work
```

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml backend/.dockerignore frontend/.dockerignore
git commit -m "feat: Dockerize full stack with docker-compose

Backend: node:20-alpine, Prisma generate + db push + seed on start.
Frontend: node:20-alpine, Vite build served by serve.
PostgreSQL with healthcheck, backend waits for healthy DB."
```

---

### Task 12: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README**

Sections:
1. Project overview (from wiki/overview.md)
2. Setup & run instructions (`docker-compose up --build`)
3. Environment variables (API key)
4. System design (from docs/concepts/domain-driven-design.md — summarize bounded contexts, invariants)
5. API documentation (from spec — endpoint table with descriptions)
6. Library justifications (Prisma, Express, React, Vercel AI SDK, Tailwind — 1 sentence each from ADRs)
7. Design assumptions (from wiki/notes/spec-ambiguities.md — the 5 assumptions)
8. Future improvements (tree-table, multi-provider LLM, Nginx reverse proxy, proficiency levels)

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: comprehensive README with design, API docs, and library justifications"
git push
```
