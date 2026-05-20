---
type: entity
title: Task
created: 2026-05-20
updated: 2026-05-20
---
# Task

## Properties

- **title** — string, user story format (e.g. "As a visitor, I want to see a responsive homepage...")
- **required skills** — list of [[wiki/entities/skill|Skills]] needed (e.g. Frontend, Backend, or both)
- **status** — one of: "To-do", "Done", etc.
- **assignee** — optional, a [[wiki/entities/developer|Developer]]
- **subtasks** — optional, list of child Tasks (see [[wiki/requirements/part4-subtasks|Part 4]])

## Relationships

- Requires one or more [[wiki/entities/skill|Skills]]
- Assigned to zero or one [[wiki/entities/developer|Developer]]
- Can have child Tasks (subtasks), each with the same properties
- Can be a child of a parent Task

## Business Rules

- A Task can only be assigned to a [[wiki/entities/developer|Developer]] who has all required [[wiki/entities/skill|Skills]]
- A Task can have its status changed (e.g. "To-do" → "Done")
- A Task can only be marked "Done" if all its subtasks have status "Done" (see [[wiki/requirements/part4-subtasks|Part 4]])
- When created without specified Skills, required Skills are auto-identified by LLM from the title (see [[wiki/requirements/part5-llm-skill-id|Part 5]])
- At creation time, a Developer does not need to be assigned
