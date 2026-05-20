// backend/src/services/taskService.ts
import prisma from '../lib/prisma.js';
import type { CreateTaskInput } from '../types.js';
import { TaskStatus } from '@prisma/client';
import { classifySkills } from './llmService.js';
import { computeFlatListWithDepth, buildTree, toPrismaCreate, collectNodesWithoutSkills } from './taskUtils.js';
import type { TaskWithRelations } from './taskUtils.js';

const taskInclude = {
  skills: { select: { id: true, name: true } },
  developer: { select: { id: true, name: true } },
};

// --- GET /api/tasks (flat list with depth) ---
export async function getAllTasksFlat() {
  const tasks = await prisma.task.findMany({ include: taskInclude });
  return computeFlatListWithDepth(tasks);
}

// --- GET /api/tasks/:id (recursive tree) ---
export async function getTaskById(id: string) {
  const tasks = await prisma.task.findMany({ include: taskInclude });
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  return buildTree(task, tasks);
}

// --- POST /api/tasks (create tree) ---
export async function createTask(input: CreateTaskInput) {
  // --- LLM enrichment ---
  const skills = await prisma.skill.findMany();
  const skillMap = new Map(skills.map(s => [s.name, s.id]));

  const needsSkills = collectNodesWithoutSkills(input);

  if (needsSkills.length > 0) {
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej('timeout'), 5000));
      const results = await Promise.race([
        Promise.allSettled(needsSkills.map(n => classifySkills(n.title))),
        timeout,
      ]);
      (results as PromiseSettledResult<string[]>[]).forEach((r, i) => {
        const node = needsSkills[i];
        if (r.status === 'fulfilled' && node) {
          node.skillIds = r.value
            .map(name => skillMap.get(name))
            .filter(Boolean) as string[];
        }
      });
    } catch (err) {
      console.warn('LLM skill classification timed out or failed:', err);
    }
  }

  // --- Prisma write (atomic) ---
  const prismaData = toPrismaCreate(input);

  // Atomic transaction — entire tree succeeds or fails together
  const created = await prisma.$transaction(async (tx) => {
    return tx.task.create({
      data: prismaData as any,
      include: taskInclude,
    });
  });

  // Re-fetch as tree for response
  return getTaskById(created.id);
}

// --- DELETE /api/tasks (test cleanup) ---
export async function deleteAllTasks() {
  await prisma.task.deleteMany();
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

  const updateData: { status?: TaskStatus; developerId?: string | null } = {};
  if (data.status) updateData.status = data.status as TaskStatus;
  if (data.developerId !== undefined) updateData.developerId = data.developerId;

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: taskInclude,
  });
  return { data: updated, status: 200 };
}
