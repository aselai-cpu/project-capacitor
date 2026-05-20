import type { TaskFormState } from '../lib/types';

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
