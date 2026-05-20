---
type: entity
title: Skill
created: 2026-05-20
updated: 2026-05-20
---
# Skill

## Properties

- **name** — string, identifies the skill (e.g. "Frontend", "Backend")

## Relationships

- Possessed by many [[wiki/entities/developer|Developers]] (many-to-many)
- Required by many [[wiki/entities/task|Tasks]]

## Business Rules

- A Skill is not unique to a Developer — multiple Developers can have the same Skill
- The initial set of Skills is "Frontend" and "Backend"
- The LLM skill identification feature (see [[wiki/requirements/part5-llm-skill-id|Part 5]]) maps task titles to these Skills
