import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from '../types.js';

describe('createTaskSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      title: 'My Task',
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
      parentId: null,
      subtasks: [],
    };
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const input = { title: '', skillIds: [], subtasks: [] };
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts recursive subtasks', () => {
    const input = {
      title: 'Parent',
      subtasks: [
        {
          title: 'Child',
          subtasks: [{ title: 'Grandchild', subtasks: [] }],
        },
      ],
    };
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtasks[0]?.subtasks[0]?.title).toBe('Grandchild');
    }
  });

  it('defaults skillIds to empty array when omitted', () => {
    const input = { title: 'Task', subtasks: [] };
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillIds).toEqual([]);
    }
  });

  it('defaults subtasks to empty array when omitted', () => {
    const input = { title: 'Task' };
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtasks).toEqual([]);
    }
  });
});

describe('updateTaskSchema', () => {
  it('accepts valid status value', () => {
    const result = updateTaskSchema.safeParse({ status: 'IN_PROGRESS' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['TODO', 'IN_PROGRESS', 'DONE']) {
      const result = updateTaskSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status value', () => {
    const result = updateTaskSchema.safeParse({ status: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('accepts valid developerId uuid', () => {
    const result = updateTaskSchema.safeParse({
      developerId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null developerId (unassign)', () => {
    const result = updateTaskSchema.safeParse({ developerId: null });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no fields required)', () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
