// backend/src/services/agentService.ts
//
// Pipeline orchestrator for the Kickstart workflow.
// Chains LLM services into a 4-step pipeline streamed via SSE:
//   1. Enrich project  2. Generate tasks  3. Process team  4. Assign & balance
//
import type { Response } from 'express';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { enrichProject, generateTasks, extractSkillsFromCV, assignTasksBalanced } from './llmService.js';
import type { GenerateTasksContext, AssignmentTask, AssignmentDeveloper } from './llmService.js';
import { createTask } from './taskService.js';

// ---------------------------------------------------------------------------
// Part 1: SSE helpers and retry logic
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Part 2: stepEnrich — Create & enrich project
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Part 3: stepGenerateTasks — Generate tasks in 3 rounds
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Part 4: stepProcessTeam — Process existing + new team members
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Part 5: stepAssign — Assign & balance with validation + retry
// ---------------------------------------------------------------------------

async function stepAssign(
  res: Response,
  tasks: AssignmentTask[],
  developers: AssignmentDeveloper[],
): Promise<{ assignments: number; balanceScore: number }> {
  sendSSE(res, 'step', { step: 'assign', status: 'running' });

  const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);

  // Edge case: no points → round-robin
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

  let finalResult: Awaited<ReturnType<typeof assignTasksBalanced>> | null = null;
  let balanceScore = 0;
  let feedback = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await withRetry(
      () => assignTasksBalanced(tasks, developers, feedback),
      res,
      'assign',
    );

    // Validate: every task assigned
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
      const lines = Array.from(devPoints.entries()).map(([id, pts]) => {
        const name = developers.find(d => d.id === id)?.name ?? id;
        return `${name}: ${pts} pts (target: ~${Math.round(avg)})`;
      });
      feedback = `Balance score too low (${Math.round(balanceScore * 100)}%). Redistribute:\n${lines.join('\n')}`;
      sendSSE(res, 'step', { step: 'assign', status: 'retrying', attempt: attempt + 1, error: 'Workload imbalanced' });
      continue;
    }

    finalResult = result;
    break;
  }

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

// ---------------------------------------------------------------------------
// Part 6: Main orchestrator
// ---------------------------------------------------------------------------

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
