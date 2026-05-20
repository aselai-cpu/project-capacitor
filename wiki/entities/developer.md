---
type: entity
title: Developer
created: 2026-05-20
updated: 2026-05-20
---
# Developer

## Properties

- **name** — string, identifies the developer (e.g. Alice, Bob)
- **skills** — list of [[wiki/entities/skill|Skills]] the developer possesses

## Relationships

- Has many [[wiki/entities/skill|Skills]] (many-to-many)
- Can be assigned many [[wiki/entities/task|Tasks]]

## Business Rules

- A Developer can only be assigned a [[wiki/entities/task|Task]] if the Developer possesses all [[wiki/entities/skill|Skills]] required by the Task
- A Developer can have multiple Skills (e.g. Frontend and Backend)

## Seed Data

| Developer | Skills             |
|-----------|--------------------|
| Alice     | Frontend           |
| Bob       | Backend            |
| Carol     | Frontend, Backend  |
| Dave      | Backend            |
