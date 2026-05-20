import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyNode, updateNodeInTree } from '../utils/treeUtils';
import type { TaskFormState } from '../lib/types';

describe('createEmptyNode', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });
  });

  it('returns object with id, empty title, empty skillIds, empty subtasks', () => {
    const node = createEmptyNode();
    expect(node).toEqual({
      id: 'test-uuid',
      title: '',
      skillIds: [],
      subtasks: [],
    });
  });

  it('each call returns a unique id via crypto.randomUUID', () => {
    let callCount = 0;
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${++callCount}`),
    });
    const node1 = createEmptyNode();
    const node2 = createEmptyNode();
    expect(node1.id).not.toBe(node2.id);
    expect(node1.id).toBe('uuid-1');
    expect(node2.id).toBe('uuid-2');
  });
});

describe('updateNodeInTree', () => {
  const makeNode = (overrides: Partial<TaskFormState> = {}): TaskFormState => ({
    id: 'root',
    title: 'Root',
    skillIds: [],
    subtasks: [],
    ...overrides,
  });

  it('updates root node title when targetId matches root', () => {
    const root = makeNode({ id: 'root', title: 'Original' });
    const result = updateNodeInTree(root, 'root', () => ({ title: 'Updated' }));
    expect(result.title).toBe('Updated');
    expect(result.id).toBe('root');
  });

  it('updates nested child node when targetId matches child', () => {
    const child: TaskFormState = { id: 'child-1', title: 'Child', skillIds: [], subtasks: [] };
    const root = makeNode({ subtasks: [child] });
    const result = updateNodeInTree(root, 'child-1', () => ({ title: 'Updated Child' }));
    expect(result.subtasks[0].title).toBe('Updated Child');
    expect(result.title).toBe('Root');
  });

  it('updates deeply nested node (3 levels)', () => {
    const grandchild: TaskFormState = { id: 'grandchild', title: 'Grandchild', skillIds: [], subtasks: [] };
    const child: TaskFormState = { id: 'child', title: 'Child', skillIds: [], subtasks: [grandchild] };
    const root = makeNode({ subtasks: [child] });
    const result = updateNodeInTree(root, 'grandchild', () => ({ title: 'Updated Grandchild' }));
    expect(result.subtasks[0].subtasks[0].title).toBe('Updated Grandchild');
  });

  it('returns unchanged tree when targetId does not match any node', () => {
    const child: TaskFormState = { id: 'child', title: 'Child', skillIds: [], subtasks: [] };
    const root = makeNode({ subtasks: [child] });
    const result = updateNodeInTree(root, 'nonexistent', () => ({ title: 'Changed' }));
    expect(result.title).toBe('Root');
    expect(result.subtasks[0].title).toBe('Child');
  });

  it('adds a subtask to a specific node via updater', () => {
    const newSubtask: TaskFormState = { id: 'new-child', title: 'New', skillIds: [], subtasks: [] };
    const root = makeNode({ id: 'root' });
    const result = updateNodeInTree(root, 'root', n => ({
      subtasks: [...n.subtasks, newSubtask],
    }));
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0].id).toBe('new-child');
  });

  it('toggles a skillId on a specific node', () => {
    const root = makeNode({ id: 'root', skillIds: ['skill-1'] });
    // Toggle off
    const result1 = updateNodeInTree(root, 'root', n => ({
      skillIds: n.skillIds.includes('skill-1')
        ? n.skillIds.filter(id => id !== 'skill-1')
        : [...n.skillIds, 'skill-1'],
    }));
    expect(result1.skillIds).toEqual([]);
    // Toggle on
    const result2 = updateNodeInTree(result1, 'root', n => ({
      skillIds: n.skillIds.includes('skill-1')
        ? n.skillIds.filter(id => id !== 'skill-1')
        : [...n.skillIds, 'skill-1'],
    }));
    expect(result2.skillIds).toEqual(['skill-1']);
  });
});
