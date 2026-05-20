---
type: decision
title: 002 — Recursive JSON payload for task tree creation
created: 2026-05-20
status: accepted
---
# ADR-002: Recursive JSON Payload for Task Tree Creation

## Context

The frontend needs to create a root task with arbitrarily nested subtasks (Part 4.3). Two approaches: (A) multiple sequential API calls for parent then each child, or (B) a single recursive JSON payload submitted in one request.

## Decision

Use a **single recursive JSON payload** submitted to `POST /api/tasks`. The backend transforms this into a Prisma nested write and commits the entire tree in one atomic transaction.

Payload shape:
```json
{
  "title": "...",
  "skillIds": [],
  "subtasks": [
    { "title": "...", "skillIds": [], "subtasks": [...] }
  ]
}
```

The backend:
1. Recursively walks the tree to enrich missing `skillIds` via LLM (Cognitive Context)
2. Transforms to Prisma nested `create` format via recursive `transformPayloadToPrismaInput()`
3. Executes inside `prisma.$transaction()` — all-or-nothing

## Consequences

- **Positive:** Single network round-trip; atomic — no partial tree states in DB
- **Positive:** LLM enrichment happens before DB write, so inferred skills are included in the transaction
- **Positive:** Frontend stays decoupled from DB internals — just sends a tree
- **Trade-off:** Large deeply-nested payloads could hit request size limits (unlikely at this scale)
- **Trade-off:** Error localization is harder — if one subtask fails validation, the whole tree rolls back
