---
type: decision
title: 006 — Express.js for backend REST API
created: 2026-05-21
status: accepted
---
# ADR-006: Express.js for Backend REST API

## Context

The spec requires "TypeScript, Node.js or a framework using Node.js" for a REST API with ~7 endpoints: CRUD for Tasks, read for Developers and Skills, with business logic guards (skill superset on assignment, status cascade on subtasks) and LLM integration via Vercel AI SDK.

Evaluated 6 frameworks (May 2026 landscape):
1. Express.js
2. Fastify
3. NestJS
4. Hono
5. tRPC
6. Elysia (Bun)

## Decision

Use **Express.js** with TypeScript and Zod for request validation.

### Why Express

- **Maximum evaluator recognition:** HTX is a Singapore government tech agency. Express is the industry standard Node.js framework — evaluators have used it, hired for it, and expect it. Zero explanation needed.
- **Fastest to ship:** 15-20 minutes to first working endpoint. Largest ecosystem of tutorials, Stack Overflow answers, and Prisma examples for when you hit snags.
- **Zero unnecessary complexity:** For 7 REST endpoints, Express adds no framework overhead. Routes, middleware, handlers — that's it.
- **TypeScript gap closable:** Express + Zod middleware gives typed request bodies in ~10 lines. Not as elegant as Hono's native types, but sufficient for 7 endpoints.

### TypeScript + Zod pattern

```typescript
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional(),
  parentId: z.string().uuid().optional(),
  subtasks: z.lazy(() => z.array(createTaskSchema)).optional(),
});

// Middleware
function validate(schema: z.ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    req.body = result.data;
    next();
  };
}

app.post('/api/tasks', validate(createTaskSchema), taskController.create);
```

## Alternatives Considered

### Hono — Runner-up (technically superior, less recognizable)

- 3-4x faster than Express (~78K req/s vs ~15K)
- First-class TypeScript (no `@types` needed, no `any` on req.body)
- Express-compatible API surface — familiar routing patterns
- 40K+ GitHub stars, used by Cloudflare, Deno, Clerk
- **Rejected because:** Low government tech recognition. Evaluators may question "what is Hono?" Performance gap irrelevant at ~10 req/min evaluation scale.
- **Note in README:** Hono listed as "Future Improvement" for production performance at scale.

### Fastify — Rejected (marginal gains, mild friction)

- 2-3x faster than Express with built-in JSON Schema validation
- Plugin architecture adds mild opinions not needed for 7 endpoints
- Evaluator reaction: "Why not Express? Performance isn't the bottleneck."

### NestJS — Rejected (over-engineered)

- Modules, controllers, services, dependency injection, decorators
- 45-60 min to first endpoint (3x slower than Express)
- Excellent TypeScript and validation, but solves problems a 7-endpoint API doesn't have
- Right choice for teams scaling to 50+ endpoints; wrong for a take-home test

### tRPC — Disqualified (not REST)

- RPC-over-HTTP paradigm violates the spec's REST API requirement
- Exceptional TypeScript end-to-end type safety, but wrong protocol

### Elysia — Disqualified (Bun-only)

- Requires non-standard Docker image (`oven/bun` instead of `node`)
- Government teams standardize on Node.js
- Bun runtime not yet mainstream in government tech

## Consequences

- **Positive:** Maximum evaluator confidence — "this is standard Node.js"
- **Positive:** Fastest development — largest ecosystem for troubleshooting
- **Positive:** Zod middleware bridges the TypeScript gap cleanly
- **Trade-off:** `req.body`, `req.params`, `req.query` default to `any` — requires Zod validation on every route (but we're doing this anyway for input validation)
- **Trade-off:** Slowest performance of the viable options (~15K req/s) — irrelevant at evaluation scale
- **Trade-off:** No built-in schema-to-OpenAPI generation — would need `swagger-jsdoc` or `express-openapi` if API docs needed beyond README
