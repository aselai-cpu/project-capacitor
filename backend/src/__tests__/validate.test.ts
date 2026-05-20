import { describe, it, expect, vi } from 'vitest';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function makeReq(body: unknown): Request {
  return { body } as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe('validate middleware', () => {
  it('valid body passes through and calls next()', () => {
    const req = makeReq({ name: 'Alice', age: 30 });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((res as any).status).not.toHaveBeenCalled();
  });

  it('invalid body returns 400 with error details', () => {
    const req = makeReq({ name: '', age: -1 });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(400);
    const jsonArg = (res as any).status.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.error).toBe('Validation error');
    expect(jsonArg.details).toBeDefined();
  });

  it('parsed (coerced) data replaces req.body', () => {
    // Use a schema with a default to verify safeParse output (not raw input) is set
    const schemaWithDefault = z.object({
      name: z.string().min(1),
      role: z.string().default('user'),
    });
    const req = makeReq({ name: 'Bob' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schemaWithDefault)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'Bob', role: 'user' });
  });
});
