---
type: requirement
title: Part 1 — Database Design & Setup
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 1: Database Design & Setup

## Overview

Create a PostgreSQL database supporting [[wiki/entities/developer|Developers]], [[wiki/entities/task|Tasks]], and [[wiki/entities/skill|Skills]] with the business logic defined in the spec.

## Operations / Features

- 1.1: Create PostgreSQL schema for all entities and their relationships
- 1.2: Seed the database with initial Developer and Skill data

## Constraints

- Must use PostgreSQL
- Developer-Skill is many-to-many
- Task-Skill is many-to-many
- Task-Developer is many-to-one (a Task has at most one assignee)
- Task self-references for subtasks (see [[wiki/requirements/part4-subtasks|Part 4]])

## Acceptance Criteria

- [ ] Schema supports Developers with name and skills
- [ ] Schema supports Tasks with title, required skills, status, and optional assignee
- [ ] Schema supports Skills as a shared resource (many-to-many with Developers)
- [ ] Seed data matches spec: Alice (Frontend), Bob (Backend), Carol (Frontend + Backend), Dave (Backend)
