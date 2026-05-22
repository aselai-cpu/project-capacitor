import type { CreateTaskInput } from '../types.js';

// Type for tasks returned by findMany with taskInclude
export interface TaskWithRelations {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  developerId: string | null;
  projectId: string | null;
  acceptanceCriteria: string | null;
  description: string | null;
  storyPoints: number | null;
  createdAt: Date;
  updatedAt: Date;
  skills: { id: string; name: string }[];
  developer: { id: string; name: string } | null;
}

export interface TaskWithDepth extends TaskWithRelations {
  depth: number;
}

export interface TaskTree extends TaskWithRelations {
  subtasks: TaskTree[];
}

export function computeFlatListWithDepth(tasks: TaskWithRelations[]): TaskWithDepth[] {
  const childrenMap = new Map<string | null, TaskWithRelations[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(task);
  }
  // Sort siblings by createdAt
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  const result: TaskWithDepth[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const child of childrenMap.get(parentId) ?? []) {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

export function buildTree(task: TaskWithRelations, allTasks: TaskWithRelations[]): TaskTree {
  const children = allTasks.filter(t => t.parentId === task.id);
  return {
    ...task,
    subtasks: children.map(c => buildTree(c, allTasks)),
  };
}

export function toPrismaCreate(node: CreateTaskInput, isRoot = true): any {
  return {
    title: node.title,
    // Only set parentId on the root node (for "Add Subtask" from List page).
    // For nested children, Prisma auto-wires parentId via subtasks: { create: [...] }.
    ...(isRoot && node.parentId ? { parent: { connect: { id: node.parentId } } } : {}),
    ...(isRoot && node.projectId ? { project: { connect: { id: node.projectId } } } : {}),
    ...(node.acceptanceCriteria ? { acceptanceCriteria: node.acceptanceCriteria } : {}),
    ...(node.description ? { description: node.description } : {}),
    ...(node.storyPoints != null ? { storyPoints: node.storyPoints } : {}),
    skills: node.skillIds.length > 0
      ? { connect: node.skillIds.map(id => ({ id })) }
      : undefined,
    subtasks: node.subtasks.length > 0
      ? { create: node.subtasks.map(child => toPrismaCreate(child, false)) }
      : undefined,
  };
}

export function collectNodesWithoutSkills(node: CreateTaskInput): CreateTaskInput[] {
  const result: CreateTaskInput[] = [];
  function collect(n: CreateTaskInput) {
    if (n.skillIds.length === 0) result.push(n);
    n.subtasks.forEach(collect);
  }
  collect(node);
  return result;
}
