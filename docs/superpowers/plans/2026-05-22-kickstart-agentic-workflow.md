# Kickstart Agentic Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page agentic workflow that takes a project description + team members and autonomously enriches the project, generates tasks, extracts CV skills, and assigns developers with workload-balanced allocation — all streamed via SSE.

**Architecture:** New SSE endpoint (`POST /api/agent/kickstart`) with an orchestrator that calls existing LLM services in a 4-step pipeline (enrich → generate tasks ∥ process team → assign). One new LLM function (`assignTasksBalanced`). Frontend page with 3 states: form → live pipeline progress → summary.

**Tech Stack:** Express + multer (SSE endpoint), Vercel AI SDK + Zod (LLM calls), React + EventSource (frontend), Langfuse (tracing via existing telemetry)

**Spec:** `docs/superpowers/specs/2026-05-22-kickstart-agentic-workflow.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `backend/src/services/agentService.ts` | Pipeline orchestrator: step sequencing, parallel execution, retry logic, SSE event emission |
| `backend/src/routes/agent.ts` | Express route: multer parsing, SSE headers, delegates to orchestrator |
| `frontend/src/pages/KickstartPage.tsx` | 3-state page container (form → progress → summary) |
| `frontend/src/components/kickstart/KickstartForm.tsx` | Input form: project name/description, team picker, CV uploads |
| `frontend/src/components/kickstart/KickstartProgress.tsx` | Vertical pipeline view with parallel step display |
| `frontend/src/components/kickstart/KickstartSummary.tsx` | Results: task list, workload bars, balance score |
| `frontend/src/lib/kickstart-types.ts` | Shared SSE event type definitions |
| `backend/src/__tests__/agentService.test.ts` | Orchestrator unit tests |
| `frontend/src/__tests__/KickstartForm.test.tsx` | Form component tests |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/services/llmService.ts:473` | Add `assignTasksBalanced()` function after `generateAllocationReason()` |
| `backend/src/index.ts:10` | Add import and register `/api/agent` router (line 35) |
| `frontend/src/App.tsx:11` | Add import and `/kickstart` route (line 31) |
| `frontend/src/components/NavBar.tsx:36` | Add "Kickstart" nav link before closing `</nav>` |
| `frontend/src/lib/api.ts:229` | Add `kickstartProject()` SSE helper at end of file |

---

## Task 1: `assignTasksBalanced()` LLM function

**Files:**
- Modify: `backend/src/services/llmService.ts:473` (append after `generateAllocationReason`)
- Test: `backend/src/__tests__/agentService.test.ts` (new file, test the Zod schema)

- [ ] **Step 1: Write failing test for the assignment Zod schema**

Create `backend/src/__tests__/agentService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const assignmentSchema = z.object({
  assignments: z.array(z.object({
    taskId: z.string(),
    developerId: z.string(),
    reason: z.string(),
  })),
});

describe('assignmentSchema', () => {
  it('accepts valid assignment array', () => {
    const input = {
      assignments: [
        { taskId: 'task-1', developerId: 'dev-1', reason: 'Best skill match' },
        { taskId: 'task-2', developerId: 'dev-2', reason: 'Balances workload' },
      ],
    };
    expect(assignmentSchema.safeParse(input).success).toBe(true);
  });

  it('rejects missing fields', () => {
    const input = { assignments: [{ taskId: 'task-1' }] };
    expect(assignmentSchema.safeParse(input).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/agentService.test.ts`
Expected: PASS (schema-only test, no implementation dependency yet)

- [ ] **Step 3: Implement `assignTasksBalanced()` in llmService.ts**

Append to `backend/src/services/llmService.ts` after line 473:

```typescript
// --- Balanced task assignment ---

const assignmentSchema = z.object({
  assignments: z.array(z.object({
    taskId: z.string(),
    developerId: z.string(),
    reason: z.string(),
  })),
});

export interface AssignmentTask {
  id: string;
  title: string;
  storyPoints: number | null;
  skills: string[];
}

export interface AssignmentDeveloper {
  id: string;
  name: string;
  skills: string[];
}

export async function assignTasksBalanced(
  tasks: AssignmentTask[],
  developers: AssignmentDeveloper[],
  feedback?: string,
): Promise<{ assignments: { taskId: string; developerId: string; reason: string }[] }> {
  const model = await getModel();

  const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const targetPerDev = developers.length > 0 ? Math.round(totalPoints / developers.length) : 0;

  const taskList = tasks.map(t =>
    `- "${t.title}" (id: ${t.id}, ${t.storyPoints ?? 0} pts) — skills: ${t.skills.join(', ') || 'none'}`
  ).join('\n');

  const devList = developers.map(d =>
    `- ${d.name} (id: ${d.id}) — skills: ${d.skills.join(', ')}`
  ).join('\n');

  const feedbackBlock = feedback ? `\n\nPREVIOUS ATTEMPT FEEDBACK:\n${feedback}\n` : '';

  const { object } = await generateObject({
    model,
    schema: assignmentSchema,
    prompt: `You are a project manager AI. Assign every task to a developer.

HARD CONSTRAINTS:
- Every task must be assigned to exactly one developer
- Developer must have at least 1 relevant skill (adjacent skills count — e.g. JavaScript dev can do React/TypeScript work)
- Do NOT assign tasks where there is zero skill relevance

OPTIMIZATION GOAL:
- Balance total story points across developers as evenly as possible
- Target: ~${targetPerDev} points per developer (${totalPoints} total / ${developers.length} developers)

TASKS:
${taskList}

DEVELOPERS:
${devList}
${feedbackBlock}
Return a JSON array of assignments. Each assignment has taskId, developerId, and a 1-sentence reason.`,
    experimental_telemetry: {
      isEnabled: true,
      metadata: { feature: 'assign-tasks-balanced', taskCount: String(tasks.length) },
    },
  });

  return object;
}
```

- [ ] **Step 4: Run all backend tests to verify nothing broke**

Run: `cd backend && npm test`
Expected: All tests pass (74+ tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/llmService.ts backend/src/__tests__/agentService.test.ts
git commit -m "feat: add assignTasksBalanced() LLM function for workload-balanced assignment"
```

---

## Task 2: Agent orchestrator service

**Files:**
- Create: `backend/src/services/agentService.ts`

- [ ] **Step 1: Create the SSE event emitter type and retry helper**

Create `backend/src/services/agentService.ts`:

```typescript
import type { Response } from 'express';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { enrichProject, generateTasks, extractSkillsFromCV, assignTasksBalanced } from './llmService.js';
import type { GenerateTasksContext, AssignmentTask, AssignmentDeveloper } from './llmService.js';
import { createTask } from './taskService.js';

// --- SSE helpers ---

export function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  res: Response,
  stepName: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        sendSSE(res, 'step', { step: stepName, status: 'retrying', attempt: attempt + 1, error: message });
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('unreachable');
}
```

- [ ] **Step 2: Add Step 1 — Create & Enrich Project**

Append to `agentService.ts`:

```typescript
// --- Step 1: Create & Enrich Project ---

async function stepEnrich(
  res: Response,
  name: string,
  description: string,
): Promise<{ projectId: string; enriched: Awaited<ReturnType<typeof enrichProject>> }> {
  sendSSE(res, 'step', { step: 'enrich', status: 'running' });

  const project = await prisma.project.create({ data: { name, description } });

  const enriched = await withRetry(() => enrichProject({ name, description }), res, 'enrich');

  await prisma.project.update({
    where: { id: project.id },
    data: {
      description: enriched.description,
      techStack: enriched.techStack,
      architecture: enriched.architecture,
      domain: enriched.domain,
      requirements: enriched.requirements,
      constraints: enriched.constraints,
      stakeholders: enriched.stakeholders,
    },
  });

  sendSSE(res, 'step', {
    step: 'enrich',
    status: 'done',
    result: { projectId: project.id, name, techStack: enriched.techStack },
  });

  return { projectId: project.id, enriched };
}
```

- [ ] **Step 3: Add Step 2 — Generate Tasks (3 rounds)**

Append to `agentService.ts`:

```typescript
// --- Step 2: Generate Tasks ---

const TASK_HINTS = [
  'core backend and infrastructure',
  'frontend and user-facing features',
  'testing, DevOps, and integrations',
];

async function stepGenerateTasks(
  res: Response,
  projectId: string,
  projectName: string,
  enriched: Awaited<ReturnType<typeof enrichProject>>,
): Promise<AssignmentTask[]> {
  sendSSE(res, 'step', { step: 'generate-tasks', status: 'running' });

  const skills = await prisma.skill.findMany();
  const skillMap = new Map(skills.map(s => [s.name, s.id]));
  const availableSkillNames = skills.map(s => s.name);
  const existingTitles: string[] = [];
  const allCreatedTasks: AssignmentTask[] = [];

  for (const hint of TASK_HINTS) {
    const ctx: GenerateTasksContext = {
      name: projectName,
      description: enriched.description,
      techStack: enriched.techStack,
      architecture: enriched.architecture,
      domain: enriched.domain,
      requirements: enriched.requirements,
      constraints: enriched.constraints,
      existingTaskTitles: existingTitles,
      availableSkillNames,
      hint,
    };

    const result = await withRetry(() => generateTasks(ctx), res, 'generate-tasks');

    for (const genTask of result.tasks) {
      // Resolve skill names to IDs, upserting missing ones
      const skillIds: string[] = [];
      for (const sName of genTask.skillNames) {
        let id = skillMap.get(sName);
        if (!id) {
          const created = await prisma.skill.upsert({
            where: { name: sName },
            update: {},
            create: { name: sName },
          });
          id = created.id;
          skillMap.set(sName, id);
          availableSkillNames.push(sName);
        }
        skillIds.push(id);
      }

      const created = await createTask({
        title: genTask.title,
        skillIds,
        parentId: null,
        subtasks: [],
        projectId,
        description: genTask.description,
        acceptanceCriteria: genTask.acceptanceCriteria,
        storyPoints: genTask.storyPoints,
      });

      existingTitles.push(genTask.title);
      allCreatedTasks.push({
        id: created!.id,
        title: genTask.title,
        storyPoints: genTask.storyPoints,
        skills: genTask.skillNames,
      });

      sendSSE(res, 'task', {
        title: genTask.title,
        storyPoints: genTask.storyPoints,
        skills: genTask.skillNames,
      });
    }
  }

  sendSSE(res, 'step', {
    step: 'generate-tasks',
    status: 'done',
    result: {
      taskCount: allCreatedTasks.length,
      totalPoints: allCreatedTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
    },
  });

  return allCreatedTasks;
}
```

- [ ] **Step 4: Add Step 3 — Process Team Members**

Append to `agentService.ts`:

```typescript
// --- Step 3: Process Team Members ---

interface NewMemberInput {
  name: string;
  cvText?: string;
}

async function stepProcessTeam(
  res: Response,
  existingDeveloperIds: string[],
  newMembers: NewMemberInput[],
  cvFiles: Map<number, Buffer>,
): Promise<AssignmentDeveloper[]> {
  sendSSE(res, 'step', { step: 'process-team', status: 'running' });

  const allDevs: AssignmentDeveloper[] = [];

  // Load existing developers
  for (const devId of existingDeveloperIds) {
    const dev = await prisma.developer.findUnique({
      where: { id: devId },
      include: { skills: true },
    });
    if (dev) {
      allDevs.push({ id: dev.id, name: dev.name, skills: dev.skills.map(s => s.name) });
      sendSSE(res, 'member', { name: dev.name, skills: dev.skills.map(s => s.name), isNew: false });
    }
  }

  // Process new members in parallel
  const newDevPromises = newMembers.map(async (member, index) => {
    const dev = await prisma.developer.create({ data: { name: member.name } });

    // Determine CV text: file upload takes precedence
    let cvText: string | undefined;
    const fileBuffer = cvFiles.get(index);
    if (fileBuffer) {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: fileBuffer });
      const textResult = await parser.getText();
      cvText = textResult.text;
      await prisma.developer.update({
        where: { id: dev.id },
        data: { cvText, cvFileName: `cv_${index}.pdf` },
      });
    } else if (member.cvText) {
      cvText = member.cvText;
      await prisma.developer.update({
        where: { id: dev.id },
        data: { cvText },
      });
    }

    let skills: string[] = [];
    if (cvText) {
      const extraction = await withRetry(
        () => extractSkillsFromCV(cvText!),
        res,
        'process-team',
      );

      // Upsert skills and connect to developer
      const skillIds: string[] = [];
      for (const s of extraction.skills) {
        const skill = await prisma.skill.upsert({
          where: { name: s.name },
          update: {},
          create: { name: s.name },
        });
        skillIds.push(skill.id);
      }

      await prisma.developer.update({
        where: { id: dev.id },
        data: {
          bio: extraction.bio,
          skills: { connect: skillIds.map(id => ({ id })) },
        },
      });

      skills = extraction.skills.map(s => s.name);
    }

    const result: AssignmentDeveloper = { id: dev.id, name: member.name, skills };
    sendSSE(res, 'member', { name: member.name, skills, isNew: true });
    return result;
  });

  const newDevs = await Promise.all(newDevPromises);
  allDevs.push(...newDevs);

  sendSSE(res, 'step', {
    step: 'process-team',
    status: 'done',
    result: { memberCount: allDevs.length },
  });

  return allDevs;
}
```

- [ ] **Step 5: Add Step 4 — Assign & Balance, plus the main orchestrator**

Append to `agentService.ts`:

```typescript
// --- Step 4: Assign & Balance ---

async function stepAssign(
  res: Response,
  tasks: AssignmentTask[],
  developers: AssignmentDeveloper[],
): Promise<{ assignments: number; balanceScore: number }> {
  sendSSE(res, 'step', { step: 'assign', status: 'running' });

  const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);

  // Edge case: no points → round-robin by skill match
  if (totalPoints === 0 || developers.length === 0) {
    let devIdx = 0;
    for (const task of tasks) {
      const dev = developers[devIdx % developers.length];
      if (dev) {
        await prisma.task.update({ where: { id: task.id }, data: { developerId: dev.id } });
        sendSSE(res, 'assignment', {
          task: task.title, developer: dev.name, points: 0, reason: 'Round-robin (no story points)',
        });
      }
      devIdx++;
    }
    sendSSE(res, 'step', { step: 'assign', status: 'done', result: { assignments: tasks.length, balanceScore: 1.0 } });
    return { assignments: tasks.length, balanceScore: 1.0 };
  }

  // Retry loop: up to 3 attempts, retry if balance < 70%
  let finalResult: Awaited<ReturnType<typeof assignTasksBalanced>> | null = null;
  let balanceScore = 0;
  let feedback = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await withRetry(
      () => assignTasksBalanced(tasks, developers, feedback),
      res,
      'assign',
    );

    // Validate: every task assigned exactly once
    const assignedTaskIds = new Set(result.assignments.map(a => a.taskId));
    const missingTasks = tasks.filter(t => !assignedTaskIds.has(t.id));
    if (missingTasks.length > 0) {
      feedback = `These tasks were NOT assigned: ${missingTasks.map(t => t.title).join(', ')}. Assign ALL tasks.`;
      if (attempt < 3) {
        sendSSE(res, 'step', { step: 'assign', status: 'retrying', attempt: attempt + 1, error: 'Not all tasks assigned' });
        continue;
      }
    }

    // Compute balance score
    const devPoints = new Map<string, number>();
    developers.forEach(d => devPoints.set(d.id, 0));
    for (const a of result.assignments) {
      const task = tasks.find(t => t.id === a.taskId);
      if (task) devPoints.set(a.developerId, (devPoints.get(a.developerId) ?? 0) + (task.storyPoints ?? 0));
    }
    const avg = totalPoints / developers.length;
    const maxDev = Math.max(...Array.from(devPoints.values()).map(p => Math.abs(p - avg)));
    balanceScore = avg > 0 ? Math.max(0, 1 - maxDev / avg) : 1.0;

    if (balanceScore < 0.7 && attempt < 3) {
      // Build feedback about over/underloaded developers
      const lines = Array.from(devPoints.entries()).map(([id, pts]) => {
        const name = developers.find(d => d.id === id)?.name ?? id;
        return `${name}: ${pts} pts (target: ~${Math.round(avg)})`;
      });
      feedback = `Balance score too low (${Math.round(balanceScore * 100)}%). Redistribute more evenly:\n${lines.join('\n')}`;
      sendSSE(res, 'step', { step: 'assign', status: 'retrying', attempt: attempt + 1, error: 'Workload imbalanced' });
      continue;
    }

    finalResult = result;
    break;
  }

  // Write assignments to DB and emit events
  if (finalResult) {
    for (const a of finalResult.assignments) {
      const task = tasks.find(t => t.id === a.taskId);
      const dev = developers.find(d => d.id === a.developerId);
      if (!task || !dev) continue;

      await prisma.task.update({ where: { id: a.taskId }, data: { developerId: a.developerId } });
      sendSSE(res, 'assignment', {
        task: task.title, developer: dev.name, points: task.storyPoints ?? 0, reason: a.reason,
      });
    }
  }

  balanceScore = Math.round(balanceScore * 100) / 100;
  sendSSE(res, 'step', {
    step: 'assign',
    status: 'done',
    result: { assignments: finalResult?.assignments.length ?? 0, balanceScore },
  });

  return { assignments: finalResult?.assignments.length ?? 0, balanceScore };
}

// --- Main Orchestrator ---

export interface KickstartInput {
  name: string;
  description: string;
  existingDeveloperIds: string[];
  newMembers: NewMemberInput[];
  cvFiles: Map<number, Buffer>;
}

export async function runKickstart(res: Response, input: KickstartInput) {
  let projectId: string | undefined;
  try {
    // Step 1: Create & Enrich
    const enrichResult = await stepEnrich(res, input.name, input.description);
    projectId = enrichResult.projectId;

    // Steps 2 & 3: parallel
    const [tasks, developers] = await Promise.all([
      stepGenerateTasks(res, projectId, input.name, enrichResult.enriched),
      stepProcessTeam(res, input.existingDeveloperIds, input.newMembers, input.cvFiles),
    ]);

    // Step 4: Assign
    const { assignments, balanceScore } = await stepAssign(res, tasks, developers);

    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    sendSSE(res, 'done', {
      projectId,
      summary: {
        taskCount: tasks.length,
        totalPoints,
        memberCount: developers.length,
        balanceScore,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Kickstart pipeline failed');
    sendSSE(res, 'error', { error: message, ...(projectId ? { partialProjectId: projectId } : {}) });
  } finally {
    res.end();
  }
}
```

- [ ] **Step 6: Run backend tests to verify nothing broke**

Run: `cd backend && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/agentService.ts
git commit -m "feat: add kickstart pipeline orchestrator with 4-step SSE agent flow"
```

---

## Task 3: Express route with SSE + multer

**Files:**
- Create: `backend/src/routes/agent.ts`
- Modify: `backend/src/index.ts:10,35`

- [ ] **Step 1: Create the agent route**

Create `backend/src/routes/agent.ts`:

```typescript
import { Router } from 'express';
import multer from 'multer';
import { runKickstart } from '../services/agentService.js';
import type { KickstartInput } from '../services/agentService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/kickstart', upload.any(), async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Parse multipart fields
  const name = req.body.name as string;
  const description = req.body.description as string;
  const existingDeveloperIds: string[] = JSON.parse(req.body.existingDeveloperIds || '[]');
  const newMembers: { name: string; cvText?: string }[] = JSON.parse(req.body.newMembers || '[]');

  // Map uploaded CV files by index (cv_0, cv_1, ...)
  const cvFiles = new Map<number, Buffer>();
  const files = req.files as Express.Multer.File[] | undefined;
  if (files) {
    for (const file of files) {
      const match = file.fieldname.match(/^cv_(\d+)$/);
      if (match) {
        cvFiles.set(parseInt(match[1]!, 10), file.buffer);
      }
    }
  }

  const input: KickstartInput = { name, description, existingDeveloperIds, newMembers, cvFiles };
  await runKickstart(res, input);
});

export default router;
```

- [ ] **Step 2: Register the route in index.ts**

In `backend/src/index.ts`, add the import at line 10 (after the allocate import):

```typescript
import agentRouter from './routes/agent.js';
```

Add the route registration at line 35 (after allocate):

```typescript
app.use('/api/agent', agentRouter);
```

- [ ] **Step 3: Run backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/agent.ts backend/src/index.ts
git commit -m "feat: add POST /api/agent/kickstart SSE endpoint with multer"
```

---

## Task 4: Frontend SSE types and API helper

**Files:**
- Create: `frontend/src/lib/kickstart-types.ts`
- Modify: `frontend/src/lib/api.ts:229`

- [ ] **Step 1: Create SSE event types**

Create `frontend/src/lib/kickstart-types.ts`:

```typescript
export type StepName = 'enrich' | 'generate-tasks' | 'process-team' | 'assign';
export type StepStatus = 'running' | 'retrying' | 'done' | 'error';

export interface StepEvent {
  step: StepName;
  status: StepStatus;
  attempt?: number;
  error?: string;
  result?: Record<string, unknown>;
}

export interface TaskEvent {
  title: string;
  storyPoints: number;
  skills: string[];
}

export interface MemberEvent {
  name: string;
  skills: string[];
  isNew: boolean;
}

export interface AssignmentEvent {
  task: string;
  developer: string;
  points: number;
  reason: string;
}

export interface DoneEvent {
  projectId: string;
  summary: {
    taskCount: number;
    totalPoints: number;
    memberCount: number;
    balanceScore: number;
  };
}

export interface ErrorEvent {
  step?: string;
  error: string;
  partialProjectId?: string;
}

export type KickstartState = 'form' | 'running' | 'done' | 'error';
```

- [ ] **Step 2: Add `kickstartProject()` SSE helper to api.ts**

Append to `frontend/src/lib/api.ts` at the end:

```typescript
// --- Kickstart Agent API (SSE) ---

export interface KickstartPayload {
  name: string;
  description: string;
  existingDeveloperIds: string[];
  newMembers: { name: string; cvText?: string }[];
  cvFiles: File[];
}

export function kickstartProject(
  payload: KickstartPayload,
  onEvent: (event: string, data: unknown) => void,
): { abort: () => void } {
  const controller = new AbortController();

  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('description', payload.description);
  formData.append('existingDeveloperIds', JSON.stringify(payload.existingDeveloperIds));
  formData.append('newMembers', JSON.stringify(payload.newMembers));
  payload.cvFiles.forEach((file, i) => {
    formData.append(`cv_${i}`, file);
  });

  fetch(`${API}/api/agent/kickstart`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  }).then(async (response) => {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(currentEvent, data);
          } catch { /* ignore parse errors */ }
          currentEvent = '';
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onEvent('error', { error: err.message });
    }
  });

  return { abort: () => controller.abort() };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/kickstart-types.ts frontend/src/lib/api.ts
git commit -m "feat: add kickstart SSE types and API helper"
```

---

## Task 5: KickstartForm component

**Files:**
- Create: `frontend/src/components/kickstart/KickstartForm.tsx`
- Test: `frontend/src/__tests__/KickstartForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/__tests__/KickstartForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KickstartForm from '../components/kickstart/KickstartForm';

vi.mock('../lib/api', () => ({
  fetchDevelopers: vi.fn(() => Promise.resolve([
    { id: 'dev-1', name: 'Alice', bio: null, cvText: null, cvFileName: null, skills: [{ id: 's1', name: 'React' }] },
    { id: 'dev-2', name: 'Bob', bio: null, cvText: null, cvFileName: null, skills: [{ id: 's2', name: 'Docker' }] },
  ])),
}));

describe('KickstartForm', () => {
  it('renders project name and description fields', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('renders existing team members as toggleable chips', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows add new member button', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByText(/add another/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/KickstartForm.test.tsx`
Expected: FAIL (component doesn't exist yet)

- [ ] **Step 3: Implement KickstartForm**

Create `frontend/src/components/kickstart/KickstartForm.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { fetchDevelopers } from '../../lib/api';
import type { Developer } from '../../lib/types';
import type { KickstartPayload } from '../../lib/api';

interface Props {
  onSubmit: (payload: KickstartPayload) => void;
}

interface NewMember {
  name: string;
  cvText: string;
  cvFile: File | null;
}

export default function KickstartForm({ onSubmit }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDevIds, setSelectedDevIds] = useState<Set<string>>(new Set());
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);

  useEffect(() => {
    fetchDevelopers().then(setDevelopers).catch(() => {});
  }, []);

  const toggleDev = (id: string) => {
    setSelectedDevIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addNewMember = () => {
    setNewMembers(prev => [...prev, { name: '', cvText: '', cvFile: null }]);
  };

  const updateNewMember = (index: number, field: keyof NewMember, value: string | File | null) => {
    setNewMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const removeNewMember = (index: number) => {
    setNewMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      existingDeveloperIds: Array.from(selectedDevIds),
      newMembers: newMembers.map(m => ({ name: m.name, ...(m.cvText ? { cvText: m.cvText } : {}) })),
      cvFiles: newMembers.map(m => m.cvFile).filter((f): f is File => f !== null),
    });
  };

  const canSubmit = name.trim() && description.trim() && (selectedDevIds.size > 0 || newMembers.some(m => m.name.trim()));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Kickstart a Project</h1>
      <p className="text-gray-500 text-sm mb-6">Describe your project and add your team. The AI agent handles the rest.</p>

      <div className="mb-5">
        <label htmlFor="project-name" className="block text-sm font-semibold text-gray-700 mb-1">Project Name</label>
        <input id="project-name" type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Healthcare Data Platform" />
      </div>

      <div className="mb-5">
        <label htmlFor="project-desc" className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
        <textarea id="project-desc" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
          placeholder="Describe what this project is about in 1-3 sentences..." />
      </div>

      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Team Members</div>

        {developers.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-3 mb-3">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Existing Team</div>
            <div className="flex flex-wrap gap-2">
              {developers.map(d => (
                <button key={d.id} type="button" onClick={() => toggleDev(d.id)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    selectedDevIds.has(d.id)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                  }`}>
                  {selectedDevIds.has(d.id) && '✓ '}{d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-50 border rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Add New Members</div>
          {newMembers.map((m, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={m.name} onChange={e => updateNewMember(i, 'name', e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Name" />
              <input type="file" accept=".pdf" onChange={e => updateNewMember(i, 'cvFile', e.target.files?.[0] ?? null)}
                className="text-xs" />
              <button type="button" onClick={() => removeNewMember(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
          <button type="button" onClick={addNewMember}
            className="text-sm text-purple-600 border border-dashed border-purple-300 px-3 py-1 rounded">
            + Add another
          </button>
        </div>
      </div>

      <button type="submit" disabled={!canSubmit}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-purple-700">
        ⚡ Kickstart Project
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/KickstartForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kickstart/KickstartForm.tsx frontend/src/__tests__/KickstartForm.test.tsx
git commit -m "feat: add KickstartForm component with team picker and CV uploads"
```

---

## Task 6: KickstartProgress component

**Files:**
- Create: `frontend/src/components/kickstart/KickstartProgress.tsx`

- [ ] **Step 1: Implement the pipeline progress view**

Create `frontend/src/components/kickstart/KickstartProgress.tsx`:

```tsx
import type { StepEvent, TaskEvent, MemberEvent, AssignmentEvent } from '../../lib/kickstart-types';

interface Props {
  projectName: string;
  steps: Record<string, StepEvent>;
  tasks: TaskEvent[];
  members: MemberEvent[];
  assignments: AssignmentEvent[];
}

const STEP_CONFIG = [
  { key: 'enrich', label: 'Enrich project description' },
  { key: 'parallel', label: null }, // marker for parallel steps
  { key: 'assign', label: 'Assign & balance workload' },
] as const;

function StepIcon({ status }: { status?: string }) {
  if (status === 'done') return <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">✓</div>;
  if (status === 'running' || status === 'retrying')
    return <div className="w-7 h-7 rounded-full border-[2.5px] border-blue-500 border-t-transparent animate-spin" />;
  return <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-sm">○</div>;
}

function ParallelSteps({ steps, tasks, members }: Pick<Props, 'steps' | 'tasks' | 'members'>) {
  return (
    <div className="flex gap-3 ml-[14px]">
      <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2 items-center mb-2">
          <StepIcon status={steps['generate-tasks']?.status} />
          <span className="font-semibold text-sm text-blue-800">Generate tasks</span>
        </div>
        <div className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
          {tasks.map((t, i) => (
            <div key={i} className="text-green-600">✓ {t.title} <span className="text-gray-400">({t.storyPoints} pts)</span></div>
          ))}
          {steps['generate-tasks']?.status === 'running' && <div className="text-blue-500">● Generating...</div>}
        </div>
      </div>
      <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex gap-2 items-center mb-2">
          <StepIcon status={steps['process-team']?.status} />
          <span className="font-semibold text-sm text-purple-800">Process team</span>
        </div>
        <div className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
          {members.map((m, i) => (
            <div key={i} className="text-green-600">✓ {m.name} <span className="text-gray-400">({m.isNew ? 'new' : 'existing'}, {m.skills.length} skills)</span></div>
          ))}
          {steps['process-team']?.status === 'running' && <div className="text-purple-500">● Processing CVs...</div>}
        </div>
      </div>
    </div>
  );
}

export default function KickstartProgress({ projectName, steps, tasks, members, assignments }: Props) {
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-lg font-bold mb-1">Setting up your project...</h2>
      <p className="text-gray-500 text-sm mb-5">{projectName}</p>

      {/* Step 1: Enrich */}
      <div className="flex gap-3 items-start mb-2">
        <StepIcon status={steps.enrich?.status} />
        <div>
          <div className={`font-semibold text-sm ${steps.enrich?.status === 'done' ? 'text-green-700' : 'text-gray-700'}`}>
            Enrich project description
          </div>
          {steps.enrich?.status === 'done' && steps.enrich.result && (
            <div className="text-xs text-gray-500 mt-0.5">
              {(steps.enrich.result.techStack as string[])?.join(', ')}
            </div>
          )}
          {steps.enrich?.status === 'retrying' && (
            <div className="text-xs text-amber-600">Retrying (attempt {steps.enrich.attempt})...</div>
          )}
        </div>
      </div>

      {/* Parallel: Steps 2 & 3 */}
      <div className="my-3">
        <ParallelSteps steps={steps} tasks={tasks} members={members} />
      </div>

      {/* Step 4: Assign */}
      <div className="flex gap-3 items-start mt-2">
        <StepIcon status={steps.assign?.status} />
        <div>
          <div className={`font-semibold text-sm ${steps.assign?.status === 'done' ? 'text-green-700' : steps.assign?.status ? 'text-gray-700' : 'text-gray-400'}`}>
            Assign & balance workload
          </div>
          {steps.assign?.status === 'running' && (
            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
              {assignments.map((a, i) => (
                <div key={i} className="text-green-600">✓ {a.task} → {a.developer}</div>
              ))}
            </div>
          )}
          {!steps.assign?.status && <div className="text-xs text-gray-400">Waiting for tasks and team...</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/kickstart/KickstartProgress.tsx
git commit -m "feat: add KickstartProgress pipeline view component"
```

---

## Task 7: KickstartSummary component

**Files:**
- Create: `frontend/src/components/kickstart/KickstartSummary.tsx`

- [ ] **Step 1: Implement the summary view**

Create `frontend/src/components/kickstart/KickstartSummary.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { TaskEvent, AssignmentEvent, DoneEvent } from '../../lib/kickstart-types';

interface Props {
  done: DoneEvent;
  tasks: TaskEvent[];
  assignments: AssignmentEvent[];
  elapsedMs: number;
}

export default function KickstartSummary({ done, tasks, assignments, elapsedMs }: Props) {
  const { summary, projectId } = done;
  const elapsedSec = Math.round(elapsedMs / 1000);

  // Build per-developer workload
  const devWorkload = new Map<string, { points: number; taskCount: number }>();
  for (const a of assignments) {
    const current = devWorkload.get(a.developer) ?? { points: 0, taskCount: 0 };
    devWorkload.set(a.developer, { points: current.points + a.points, taskCount: current.taskCount + 1 });
  }
  const maxPoints = Math.max(...Array.from(devWorkload.values()).map(w => w.points), 1);

  const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <div>
      {/* Success banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <div className="text-lg font-bold text-green-800">✓ Project is ready</div>
          <div className="text-sm text-green-600">
            {summary.taskCount} tasks · {summary.totalPoints} points · {summary.memberCount} members · {elapsedSec}s
          </div>
        </div>
        <Link to={`/projects/${projectId}`}
          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600">
          View Project →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Tasks */}
        <div>
          <h3 className="font-bold mb-3">Generated Tasks</h3>
          <div className="border rounded-lg overflow-hidden text-sm">
            {tasks.slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between px-3 py-2 border-b last:border-b-0">
                <span className="truncate mr-2">{t.title}</span>
                <span className="text-purple-600 font-semibold whitespace-nowrap">{t.storyPoints} pts</span>
              </div>
            ))}
            {tasks.length > 8 && (
              <div className="px-3 py-2 text-gray-400 text-center">+ {tasks.length - 8} more tasks</div>
            )}
          </div>
        </div>

        {/* Right: Workload */}
        <div>
          <h3 className="font-bold mb-3">Team Workload</h3>
          <div className="space-y-3 text-sm">
            {Array.from(devWorkload.entries()).map(([devName, wl], i) => (
              <div key={devName}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">{devName}</span>
                  <span className="text-gray-500">{wl.points} pts ({wl.taskCount} tasks)</span>
                </div>
                <div className="bg-gray-200 rounded h-2 overflow-hidden">
                  <div className="h-full rounded" style={{
                    width: `${(wl.points / maxPoints) * 100}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <strong>Balance score:</strong> {Math.round(summary.balanceScore * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/kickstart/KickstartSummary.tsx
git commit -m "feat: add KickstartSummary component with task list and workload bars"
```

---

## Task 8: KickstartPage container and route wiring

**Files:**
- Create: `frontend/src/pages/KickstartPage.tsx`
- Modify: `frontend/src/App.tsx:11,31`
- Modify: `frontend/src/components/NavBar.tsx:36`

- [ ] **Step 1: Create KickstartPage**

Create `frontend/src/pages/KickstartPage.tsx`:

```tsx
import { useState, useCallback, useRef } from 'react';
import KickstartForm from '../components/kickstart/KickstartForm';
import KickstartProgress from '../components/kickstart/KickstartProgress';
import KickstartSummary from '../components/kickstart/KickstartSummary';
import { kickstartProject } from '../lib/api';
import type { KickstartPayload } from '../lib/api';
import type { KickstartState, StepEvent, TaskEvent, MemberEvent, AssignmentEvent, DoneEvent, ErrorEvent } from '../lib/kickstart-types';

export default function KickstartPage() {
  const [state, setState] = useState<KickstartState>('form');
  const [projectName, setProjectName] = useState('');
  const [steps, setSteps] = useState<Record<string, StepEvent>>({});
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [members, setMembers] = useState<MemberEvent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEvent[]>([]);
  const [doneData, setDoneData] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<ErrorEvent | null>(null);
  const startTime = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const handleSubmit = useCallback((payload: KickstartPayload) => {
    setState('running');
    setProjectName(payload.name);
    startTime.current = Date.now();

    kickstartProject(payload, (event, data) => {
      switch (event) {
        case 'step':
          setSteps(prev => ({ ...prev, [(data as StepEvent).step]: data as StepEvent }));
          break;
        case 'task':
          setTasks(prev => [...prev, data as TaskEvent]);
          break;
        case 'member':
          setMembers(prev => [...prev, data as MemberEvent]);
          break;
        case 'assignment':
          setAssignments(prev => [...prev, data as AssignmentEvent]);
          break;
        case 'done':
          setDoneData(data as DoneEvent);
          setElapsedMs(Date.now() - startTime.current);
          setState('done');
          break;
        case 'error':
          setError(data as ErrorEvent);
          setState('error');
          break;
      }
    });
  }, []);

  return (
    <main className="p-6">
      {state === 'form' && <KickstartForm onSubmit={handleSubmit} />}

      {state === 'running' && (
        <KickstartProgress
          projectName={projectName}
          steps={steps}
          tasks={tasks}
          members={members}
          assignments={assignments}
        />
      )}

      {state === 'done' && doneData && (
        <KickstartSummary done={doneData} tasks={tasks} assignments={assignments} elapsedMs={elapsedMs} />
      )}

      {state === 'error' && error && (
        <div className="max-w-xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="font-bold text-red-800">Pipeline failed</div>
            <div className="text-sm text-red-600 mt-1">{error.error}</div>
            {error.partialProjectId && (
              <a href={`/projects/${error.partialProjectId}`} className="text-sm text-blue-600 underline mt-2 inline-block">
                View partial results →
              </a>
            )}
            <button onClick={() => { setState('form'); setSteps({}); setTasks([]); setMembers([]); setAssignments([]); setError(null); }}
              className="mt-3 text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">
              Try again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `frontend/src/App.tsx`, add the import at line 11 (after AllocationPage):

```typescript
import KickstartPage from './pages/KickstartPage';
```

Add the route at line 31 (after the allocate route):

```tsx
<Route path="/kickstart" element={<KickstartPage />} />
```

- [ ] **Step 3: Add nav link to NavBar.tsx**

In `frontend/src/components/NavBar.tsx`, add after the Allocate link (before closing `</nav>` at line 36):

```tsx
      <Link to="/kickstart"
        className={`px-3 py-1.5 rounded text-sm font-semibold ${pathname.startsWith('/kickstart') ? 'bg-purple-700 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        Kickstart
      </Link>
```

- [ ] **Step 4: Run all frontend tests**

Run: `cd frontend && npm test`
Expected: All tests pass (29+ tests)

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass (74+ tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/KickstartPage.tsx frontend/src/App.tsx frontend/src/components/NavBar.tsx
git commit -m "feat: add /kickstart page with form, progress, and summary states"
```

---

## Task 9: Docker rebuild and manual smoke test

**Files:** None (integration test)

- [ ] **Step 1: Rebuild the Docker stack**

```bash
cd /Users/aselaillayapparachchi/code/Thoughtworks/capacitor
docker compose up -d --build backend frontend
```

Expected: Both containers rebuild and start successfully.

- [ ] **Step 2: Smoke test the full flow**

1. Open `http://localhost:3000/kickstart`
2. Enter a project name and description (e.g. "Healthcare Data Platform" / "Build an internal platform for patient data ingestion and clinical dashboards")
3. Select 1-2 existing team members
4. Click "Kickstart Project"
5. Verify: pipeline steps appear and progress (enrich → tasks ∥ team → assign)
6. Verify: summary shows tasks, workload bars, balance score
7. Click "View Project" and verify tasks appear on the project page

- [ ] **Step 3: Check Langfuse traces**

Open `http://localhost:3002` (Langfuse UI, admin@capacitor.dev / admin123). Verify a trace named `agent:kickstart` appears with nested spans for each step.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete kickstart agentic workflow — SSE pipeline, balanced assignment, live progress UI"
```
