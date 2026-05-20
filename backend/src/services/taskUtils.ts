import type { CreateTaskInput } from '../types.js';

export function computeFlatListWithDepth(tasks: any[]) {
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

export function buildTree(task: any, allTasks: any[]): any {
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
