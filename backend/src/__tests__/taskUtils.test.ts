import { describe, it, expect } from 'vitest';
import {
  computeFlatListWithDepth,
  buildTree,
  toPrismaCreate,
  collectNodesWithoutSkills,
} from '../services/taskUtils.js';
import type { CreateTaskInput } from '../types.js';

// --- Helpers ---
function makeTask(overrides: Record<string, unknown>) {
  return {
    id: 'id-1',
    parentId: null,
    title: 'Task',
    status: 'TODO',
    developerId: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    skills: [],
    developer: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: 'Task',
    skillIds: [],
    parentId: null,
    subtasks: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFlatListWithDepth
// ─────────────────────────────────────────────────────────────────────────────
describe('computeFlatListWithDepth', () => {
  it('returns empty array when given no tasks', () => {
    expect(computeFlatListWithDepth([])).toEqual([]);
  });

  it('single root task gets depth 0', () => {
    const tasks = [makeTask({ id: 'root', parentId: null })];
    const result = computeFlatListWithDepth(tasks);
    expect(result).toHaveLength(1);
    expect(result[0]!.depth).toBe(0);
    expect(result[0]!.id).toBe('root');
  });

  it('root with one child: root depth 0, child depth 1', () => {
    const tasks = [
      makeTask({ id: 'root', parentId: null, createdAt: new Date('2024-01-01') }),
      makeTask({ id: 'child', parentId: 'root', createdAt: new Date('2024-01-02') }),
    ];
    const result = computeFlatListWithDepth(tasks);
    expect(result).toHaveLength(2);
    expect(result[0]!).toMatchObject({ id: 'root', depth: 0 });
    expect(result[1]!).toMatchObject({ id: 'child', depth: 1 });
  });

  it('three levels deep: depths 0, 1, 2', () => {
    const tasks = [
      makeTask({ id: 'root', parentId: null, createdAt: new Date('2024-01-01') }),
      makeTask({ id: 'child', parentId: 'root', createdAt: new Date('2024-01-02') }),
      makeTask({ id: 'grandchild', parentId: 'child', createdAt: new Date('2024-01-03') }),
    ];
    const result = computeFlatListWithDepth(tasks);
    expect(result).toHaveLength(3);
    expect(result[0]!).toMatchObject({ id: 'root', depth: 0 });
    expect(result[1]!).toMatchObject({ id: 'child', depth: 1 });
    expect(result[2]!).toMatchObject({ id: 'grandchild', depth: 2 });
  });

  it('multiple roots sorted by createdAt', () => {
    const tasks = [
      makeTask({ id: 'root-b', parentId: null, createdAt: new Date('2024-01-02') }),
      makeTask({ id: 'root-a', parentId: null, createdAt: new Date('2024-01-01') }),
    ];
    const result = computeFlatListWithDepth(tasks);
    expect(result[0]!.id).toBe('root-a');
    expect(result[1]!.id).toBe('root-b');
  });

  it('siblings sorted by createdAt', () => {
    const tasks = [
      makeTask({ id: 'root', parentId: null, createdAt: new Date('2024-01-01') }),
      makeTask({ id: 'sib-b', parentId: 'root', createdAt: new Date('2024-01-03') }),
      makeTask({ id: 'sib-a', parentId: 'root', createdAt: new Date('2024-01-02') }),
    ];
    const result = computeFlatListWithDepth(tasks);
    expect(result[1]!.id).toBe('sib-a');
    expect(result[2]!.id).toBe('sib-b');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTree
// ─────────────────────────────────────────────────────────────────────────────
describe('buildTree', () => {
  it('single task with no children returns task with empty subtasks', () => {
    const task = makeTask({ id: 'root' });
    const result = buildTree(task, [task]);
    expect(result.subtasks).toEqual([]);
    expect(result.id).toBe('root');
  });

  it('task with children nests them correctly', () => {
    const root = makeTask({ id: 'root', parentId: null });
    const child = makeTask({ id: 'child', parentId: 'root' });
    const result = buildTree(root, [root, child]);
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0]!.id).toBe('child');
  });

  it('three-level deep nesting works recursively', () => {
    const root = makeTask({ id: 'root', parentId: null });
    const child = makeTask({ id: 'child', parentId: 'root' });
    const grandchild = makeTask({ id: 'grandchild', parentId: 'child' });
    const result = buildTree(root, [root, child, grandchild]);
    expect(result.subtasks[0]!.subtasks[0]!.id).toBe('grandchild');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toPrismaCreate
// ─────────────────────────────────────────────────────────────────────────────
describe('toPrismaCreate', () => {
  it('simple task with no skills and no subtasks', () => {
    const input = makeInput({ title: 'My Task' });
    const result = toPrismaCreate(input);
    expect(result.title).toBe('My Task');
    expect(result.skills).toBeUndefined();
    expect(result.subtasks).toBeUndefined();
    expect(result.parent).toBeUndefined();
  });

  it('task with skillIds produces connect array', () => {
    const input = makeInput({ skillIds: ['skill-1', 'skill-2'] });
    const result = toPrismaCreate(input);
    expect(result.skills).toEqual({ connect: [{ id: 'skill-1' }, { id: 'skill-2' }] });
  });

  it('task with subtasks produces nested create array', () => {
    const input = makeInput({
      title: 'Parent',
      subtasks: [makeInput({ title: 'Child' })],
    });
    const result = toPrismaCreate(input);
    expect(result.subtasks).toEqual({
      create: [{ title: 'Child', skills: undefined, subtasks: undefined }],
    });
  });

  it('root with parentId produces parent: { connect }', () => {
    const input = makeInput({ parentId: 'parent-uuid' });
    const result = toPrismaCreate(input, true);
    expect(result.parent).toEqual({ connect: { id: 'parent-uuid' } });
  });

  it('nested child does NOT include parentId when isRoot=false', () => {
    const input = makeInput({ parentId: 'parent-uuid' });
    const result = toPrismaCreate(input, false);
    expect(result.parent).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// collectNodesWithoutSkills
// ─────────────────────────────────────────────────────────────────────────────
describe('collectNodesWithoutSkills', () => {
  it('all nodes have skills — returns empty array', () => {
    const input = makeInput({
      skillIds: ['s1'],
      subtasks: [makeInput({ skillIds: ['s2'] })],
    });
    expect(collectNodesWithoutSkills(input)).toEqual([]);
  });

  it('root has no skills — returns root', () => {
    const input = makeInput({ skillIds: [], subtasks: [] });
    const result = collectNodesWithoutSkills(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(input);
  });

  it('mixed: some have skills, some do not — returns only empty ones', () => {
    const childWithSkills = makeInput({ title: 'Has skills', skillIds: ['s1'] });
    const childWithout = makeInput({ title: 'No skills', skillIds: [] });
    const input = makeInput({ skillIds: ['s-root'], subtasks: [childWithSkills, childWithout] });
    const result = collectNodesWithoutSkills(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(childWithout);
  });

  it('nested nodes without skills are collected', () => {
    const grandchild = makeInput({ title: 'Grandchild', skillIds: [] });
    const child = makeInput({ title: 'Child', skillIds: ['s1'], subtasks: [grandchild] });
    const input = makeInput({ skillIds: ['s2'], subtasks: [child] });
    const result = collectNodesWithoutSkills(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(grandchild);
  });
});
