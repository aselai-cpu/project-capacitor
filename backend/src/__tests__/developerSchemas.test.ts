import { describe, it, expect } from 'vitest';
import { createDeveloperSchema, updateDeveloperSchema } from '../types.js';

describe('createDeveloperSchema', () => {
  it('accepts valid input with name only', () => {
    const result = createDeveloperSchema.safeParse({ name: 'Alice' });
    expect(result.success).toBe(true);
  });

  it('accepts name with optional skillIds', () => {
    const result = createDeveloperSchema.safeParse({
      name: 'Bob',
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createDeveloperSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createDeveloperSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid skillIds', () => {
    const result = createDeveloperSchema.safeParse({ name: 'X', skillIds: ['not-uuid'] });
    expect(result.success).toBe(false);
  });
});

describe('updateDeveloperSchema', () => {
  it('accepts partial name update', () => {
    const result = updateDeveloperSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial bio update', () => {
    const result = updateDeveloperSchema.safeParse({ bio: 'Senior dev' });
    expect(result.success).toBe(true);
  });

  it('accepts skillIds update', () => {
    const result = updateDeveloperSchema.safeParse({
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateDeveloperSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts empty object (no-op update)', () => {
    const result = updateDeveloperSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
