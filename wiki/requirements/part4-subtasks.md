---
type: requirement
title: Part 4 — Subtask Feature
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 4: Subtask Feature

## Overview

Extend [[wiki/entities/task|Tasks]] to support nested subtasks. Each subtask has the same properties as a Task. Subtasks can be nested arbitrarily deep.

## Operations / Features

- 4.1: Modify database schema to support subtasks (self-referencing Task)
- 4.2: Implement status cascade rule — a Task can only be marked "Done" if all its subtasks are "Done"
- 4.3: Modify Task Creation page to support creating subtasks and nested subtasks dynamically

### Frontend Behavior
- "Add Subtask" button next to each task component
- Additional React components rendered dynamically on the same page
- Nested visual indentation (wireframe shows 3 levels: Task 1 → 1.1 → 1.1.1, 1.1.2)

## Constraints

- Subtasks have the same properties as Tasks (title, skills, status, assignee)
- Recursive/self-referencing relationship in the database
- Status cascade is enforced — parent cannot be "Done" unless all children are "Done"

## Acceptance Criteria

- [ ] Database schema supports self-referencing Task (parent_id or equivalent)
- [ ] API enforces: parent Task cannot be set to "Done" if any subtask is not "Done"
- [ ] Task Creation page renders "Add Subtask" buttons dynamically
- [ ] Subtasks can be nested (subtask of a subtask)
- [ ] Each subtask has its own title, skills, status, assignee fields
