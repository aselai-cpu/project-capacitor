// backend/src/services/taskService.ts
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { CreateTaskInput } from '../types.js';
import { TaskStatus } from '@prisma/client';
import { classifySkills, recommendDeveloper } from './llmService.js';
import type { DeveloperInfo } from './llmService.js';
import { computeFlatListWithDepth, buildTree, toPrismaCreate, collectNodesWithoutSkills } from './taskUtils.js';
import type { TaskWithRelations } from './taskUtils.js';

const taskInclude = {
  skills: { select: { id: true, name: true } },
  developer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
};

// --- Discriminated union return type for updateTask ---
export type UpdateResult =
  | { success: true; data: any; status: 200 }
  | { success: false; error: string; status: 400 | 404 | 422; details?: unknown };

// --- Validation helpers ---
function validateStatusCascade(subtasks: any[], newStatus: string): UpdateResult | null {
  if (newStatus !== 'DONE') return null;
  const pending = subtasks.filter(s => s.status !== 'DONE');
  if (pending.length === 0) return null;
  return {
    success: false,
    error: 'Cannot mark as done: subtasks not completed',
    status: 400,
    details: { pending_subtasks: pending.map(s => ({ id: s.id, title: s.title, status: s.status })) },
  };
}

async function validateAssignment(
  taskSkills: any[],
  developerId: string,
): Promise<UpdateResult | null> {
  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    include: { skills: true },
  });
  if (!developer) {
    return { success: false, error: 'Developer not found', status: 404 };
  }

  const devSkillIds = new Set(developer.skills.map((s: any) => s.id));
  const taskSkillIds = taskSkills.map((s: any) => s.id);
  const missing = taskSkillIds.filter((id: string) => !devSkillIds.has(id));
  if (missing.length > 0) {
    return {
      success: false,
      error: 'Developer lacks required skills',
      status: 422,
      details: {
        required: taskSkills.map((s: any) => s.name),
        developer_skills: developer.skills.map((s: any) => s.name),
      },
    };
  }
  return null;
}

// --- GET /api/tasks (flat list with depth) ---
export interface TaskFilters {
  projectId?: string;
  status?: string;
  developerId?: string;
}

export async function getAllTasksFlat(filters?: TaskFilters) {
  const where: Record<string, unknown> = {};
  if (filters?.projectId) where.projectId = filters.projectId;
  if (filters?.status) where.status = filters.status;
  if (filters?.developerId) {
    where.developerId = filters.developerId === 'unassigned' ? null : filters.developerId;
  }

  const tasks = await prisma.task.findMany({ where, include: taskInclude });
  return computeFlatListWithDepth(tasks);
}

// --- GET /api/tasks/:id (recursive tree) ---
export async function getTaskById(id: string) {
  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;

  const allTasks = await prisma.task.findMany({ include: taskInclude });
  const task = allTasks.find(t => t.id === id)!;
  return buildTree(task, allTasks);
}

// --- POST /api/tasks (create tree) ---
export async function createTask(input: CreateTaskInput) {
  // --- LLM enrichment ---
  const skills = await prisma.skill.findMany();
  const skillMap = new Map(skills.map(s => [s.name, s.id]));
  const availableSkillNames = skills.map(s => s.name);

  const needsSkills = collectNodesWithoutSkills(input);

  if (needsSkills.length > 0) {
    try {
      const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 5000;
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej('timeout'), LLM_TIMEOUT_MS));
      const results = await Promise.race([
        Promise.allSettled(needsSkills.map(n => classifySkills(n.title, availableSkillNames))),
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
      logger.warn({ err }, 'LLM skill classification timed out or failed');
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

// --- POST /api/tasks/:id/recommend-assignee ---
export async function getRecommendedAssignee(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { skills: true },
  });
  if (!task) return null;

  const taskSkillIds = new Set(task.skills.map(s => s.id));
  const taskSkillNames = task.skills.map(s => s.name);

  // Get all developers with skills
  const allDevs = await prisma.developer.findMany({
    include: {
      skills: true,
      tasks: { select: { id: true } },
    },
  });

  // Filter to developers with at least one matching skill, sorted by overlap (best first)
  const eligible: DeveloperInfo[] = allDevs
    .map(d => {
      const devSkillIds = new Set(d.skills.map(s => s.id));
      const overlap = task.skills.filter(s => devSkillIds.has(s.id)).length;
      return { d, overlap };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .map(({ d }) => ({
      id: d.id,
      name: d.name,
      skills: d.skills.map(s => s.name),
      currentTaskCount: d.tasks.length,
    }));

  return recommendDeveloper(task.title, taskSkillNames, eligible);
}

// --- DELETE /api/tasks/:id (single task with cascade) ---
export async function deleteTask(id: string): Promise<boolean> {
  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  await prisma.task.delete({ where: { id } });
  return true;
}

// --- DELETE /api/tasks (test cleanup) ---
export async function deleteAllTasks() {
  await prisma.task.deleteMany();
}

// --- PATCH /api/tasks/:id (update with guards) ---
export async function updateTask(
  id: string,
  data: { status?: string; developerId?: string | null; storyPoints?: number },
): Promise<UpdateResult> {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { skills: true, subtasks: true },
  });
  if (!task) return { success: false, error: 'Task not found', status: 404 };

  // Invariant B: cascade guard on DONE
  if (data.status) {
    const cascadeError = validateStatusCascade(task.subtasks, data.status);
    if (cascadeError) return cascadeError;
  }

  // Invariant A: skill superset guard on assignment
  if (data.developerId) {
    const assignmentError = await validateAssignment(task.skills, data.developerId);
    if (assignmentError) return assignmentError;
  }

  const updateData: { status?: TaskStatus; developerId?: string | null; storyPoints?: number } = {};
  if (data.status) updateData.status = data.status as TaskStatus;
  if (data.developerId !== undefined) updateData.developerId = data.developerId;
  if (data.storyPoints !== undefined) updateData.storyPoints = data.storyPoints;

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: taskInclude,
  });
  return { success: true, data: updated, status: 200 };
}
