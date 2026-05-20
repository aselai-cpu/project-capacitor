# Wiki Index

Content catalog for Project Capacitor wiki. Read this first.

## Overview

- [[wiki/overview]] -- Project synthesis: tech stack, scope (7 parts), key business rules

## Entities

- [[wiki/entities/developer]] -- Developer entity: name, skills, task assignments, seed data
- [[wiki/entities/task]] -- Task entity: title, required skills, status, assignee, subtask rules
- [[wiki/entities/skill]] -- Skill entity: name, many-to-many with developers and tasks

## Requirements

- [[wiki/requirements/part1-database]] -- Part 1: PostgreSQL schema, entities, seed data
- [[wiki/requirements/part2-backend-api]] -- Part 2: CRUD for Tasks, read for Developers/Skills
- [[wiki/requirements/part3-frontend]] -- Part 3: SPA with Task List and Task Creation pages
- [[wiki/requirements/part4-subtasks]] -- Part 4: Nested subtasks, status cascade rules
- [[wiki/requirements/part5-llm-skill-id]] -- Part 5: LLM auto-identifies required skills from task title
- [[wiki/requirements/part6-containerization]] -- Part 6: Docker/docker-compose for full stack
- [[wiki/requirements/part7-deliverables]] -- Part 7: Public GitHub repo, README with setup, design, API docs

## Decisions

- [[wiki/decisions/001-prisma-orm]] -- ADR-001: Prisma ORM with explicit join tables, UUID keys, schema-first
- [[wiki/decisions/002-recursive-task-payload]] -- ADR-002: Single recursive JSON payload for atomic task tree creation
- [[wiki/decisions/003-docker-multi-stage]] -- ADR-003: Multi-stage Docker builds, Nginx frontend, healthcheck orchestration

## Notes

- [[wiki/notes/meta-constraints]] -- Important notes: assumptions, AI usage, timeline, sample task data from wireframes
- [[wiki/notes/gemini-design-discussion]] -- DDD/TOGAF exploration: bounded contexts, invariants, implementation patterns, API contracts
- [[wiki/notes/research-papers]] -- 11 papers across 5 pillars: LLM in RE, skill allocation, hierarchical state, structured LLM output, React architecture
