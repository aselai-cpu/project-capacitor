---
type: requirement
title: Part 3 — Frontend Implementation
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 3: Frontend Implementation

## Overview

Create a single-page application (SPA) using TypeScript, React or a React-based framework.

## Operations / Features

### Task List Page
- All existing Tasks listed with their relevant attributes
- A Task can be assigned to a [[wiki/entities/developer|Developer]] with the required [[wiki/entities/skill|Skill(s)]]
- The status of a Task can be updated
- Wireframe: table with columns — Task Title, Skills, Status (dropdown), Assignee (dropdown)

### Task Creation Page
- A new Task can be created by submitting a form
- User can specify required Skill(s) at creation time
- User does NOT need to assign a Developer at creation time
- Wireframe: form with a "New Task Component" and a Save button

## Constraints

- Must use TypeScript with React or React-based framework
- SPA (single-page application)

## Acceptance Criteria

- [ ] Task List page displays all tasks with title, skills, status, assignee
- [ ] Status can be changed via dropdown on Task List page
- [ ] Developer can be assigned via dropdown (filtered by required skills)
- [ ] Task Creation page with form for title and skill selection
- [ ] Save button creates the task via API
