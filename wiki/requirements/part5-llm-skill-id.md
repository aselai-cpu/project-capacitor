---
type: requirement
title: Part 5 — Skill Identification Using LLM
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 5: Skill Identification Using LLM

## Overview

Use an LLM to automatically identify required [[wiki/entities/skill|Skills]] for [[wiki/entities/task|Tasks]] and subtasks that don't have user-specified skills.

## Operations / Features

- 5.1: Given a Task title, the LLM identifies required Skills (Frontend, Backend, or both)
- 5.2: Integrate backend with an LLM API (e.g. Gemini, which offers free access)
- 5.3: Automatic — no manual trigger needed on the frontend. When a Task (including subtask) is created without skills, the backend auto-generates them via LLM

### Examples from Spec
- "As a visitor, I want to see a responsive homepage..." → **Frontend**
- "As a system administrator, I want audit logs..." → **Backend**
- "As a logged-in user, I want to update my profile and upload a profile picture..." → **Frontend, Backend**

## Constraints

- Must use an LLM API (any provider — Gemini suggested for free access)
- Triggered automatically on the backend at task creation time
- Only runs when user has not specified Skills

## Acceptance Criteria

- [ ] Backend integrates with an LLM API
- [ ] When a Task is created without skills, the backend calls the LLM to identify them
- [ ] LLM correctly maps task titles to Frontend, Backend, or both
- [ ] Works for subtasks as well as top-level tasks
