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

## Decisions

(none yet)

## Notes

(none yet)
