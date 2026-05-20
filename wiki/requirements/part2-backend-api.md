---
type: requirement
title: Part 2 — Backend API Implementation
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 2: Backend API Implementation

## Overview

Create backend API using TypeScript / Node.js for CRUD operations on [[wiki/entities/task|Tasks]] and read operations on [[wiki/entities/developer|Developers]] and [[wiki/entities/skill|Skills]].

## Operations / Features

### Tasks
- **Create** — A new Task can be created
- **Read** — A Task and all its relevant properties can be read
- **Update** — A Task can be assigned to a Developer (with skill validation), and its status can be changed

### Developers
- **Read** — A Developer and all their relevant properties can be read

### Skills
- **Read** — A Skill and all its relevant properties can be read

## Constraints

- Must use TypeScript with Node.js or a Node.js-based framework
- Task assignment must validate that the Developer has the required Skill(s)
- No delete operations specified

## Acceptance Criteria

- [ ] POST endpoint to create a Task
- [ ] GET endpoint to read a Task with all properties
- [ ] PUT/PATCH endpoint to assign a Developer to a Task (validates skills)
- [ ] PUT/PATCH endpoint to update a Task's status
- [ ] GET endpoint to read a Developer with properties
- [ ] GET endpoint to read Skills
