---
type: note
title: Project Overview
created: 2026-05-20
updated: 2026-05-20
---
# Project Overview

Project Capacitor is a full-stack **Task Assignment** application, built as a take-home test for the xDigital AI Products Team at HTX.

## Tech Stack

- **Frontend:** TypeScript, React (or React-based framework)
- **Backend:** TypeScript, Node.js (or Node.js-based framework)
- **Database:** PostgreSQL
- **Containerization:** Docker / docker-compose
- **AI Integration:** LLM API (e.g. Gemini) for skill identification

## Scope

The application has 7 parts, to be completed in 3 calendar days (with up to 2-day extension available):

1. **[[wiki/requirements/part1-database|Part 1: Database Design & Setup]]** — PostgreSQL schema for [[wiki/entities/developer|Developers]], [[wiki/entities/task|Tasks]], and [[wiki/entities/skill|Skills]] with seed data
2. **[[wiki/requirements/part2-backend-api|Part 2: Backend API]]** — CRUD operations for Tasks, read operations for Developers and Skills
3. **[[wiki/requirements/part3-frontend|Part 3: Frontend SPA]]** — Task List page and Task Creation page
4. **[[wiki/requirements/part4-subtasks|Part 4: Subtask Feature]]** — Nested subtasks with recursive structure and status cascade rules
5. **[[wiki/requirements/part5-llm-skill-id|Part 5: LLM Skill Identification]]** — Auto-identify required skills from task title using LLM
6. **[[wiki/requirements/part6-containerization|Part 6: Containerization]]** — Docker/docker-compose for the full solution
7. **Part 7: Deliverables** — Push to GitHub, README with setup docs, system design, API docs

## Key Business Rules

- A Task can only be assigned to a [[wiki/entities/developer|Developer]] who has the [[wiki/entities/skill|Skill(s)]] required by the Task
- A Task can only be marked "Done" if all its subtasks are "Done"
- When a Task is created without specified Skills, the backend auto-identifies them via LLM
