---
type: decision
title: 001 — Use Prisma ORM for database layer
created: 2026-05-20
status: accepted
---
# ADR-001: Use Prisma ORM for Database Layer

## Context

The project needs a PostgreSQL ORM/query layer for TypeScript/Node.js. Key requirements: type-safe queries, support for self-referencing relationships (subtask tree), atomic nested writes for creating entire task trees in one transaction, and a schema-first migration workflow.

## Decision

Use **Prisma** with schema-first approach and explicit join tables for many-to-many relationships.

- `schema.prisma` as single source of truth for DB types
- Explicit `DeveloperSkill` and `TaskSkill` join tables (not Prisma implicit M:N) for future extensibility (e.g., adding proficiency metadata)
- `TaskStatus` enum mapping "To-do" → `TODO`, "Done" → `DONE`
- UUID primary keys on all entities
- Self-referencing `Task` via `parentId` with `ON DELETE CASCADE`
- `@google/genai` SDK for Gemini LLM integration

## Consequences

- **Positive:** Full TypeScript type generation from schema; nested `create` syntax handles recursive subtask trees atomically; migration tooling built-in
- **Positive:** Explicit join tables allow adding metadata later without schema refactoring
- **Trade-off:** More boilerplate than implicit M:N, but safer for evolution
- **Trade-off:** Business invariants (skill guard, status cascade) enforced in application service layer, not DB triggers — keeps logic testable but requires discipline
