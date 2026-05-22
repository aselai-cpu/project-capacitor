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
