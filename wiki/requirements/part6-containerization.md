---
type: requirement
title: Part 6 — Containerize Solution
created: 2026-05-20
updated: 2026-05-20
source: "[[raw/Software Engineering Take Home Test v2.0.pdf]]"
---
# Part 6: Containerize Solution

## Overview

Containerize the entire solution (frontend, backend, database) using Docker so it can be run with a single `docker-compose` command.

## Operations / Features

- 6.1: Containerize all components including dependencies
- 6.2: Provide a docker-compose configuration for the full stack

## Constraints

- Must use Docker
- Must be executable via docker-compose
- Must include all dependencies (no manual setup outside of Docker)

## Acceptance Criteria

- [ ] Dockerfile(s) for frontend and backend
- [ ] docker-compose.yml orchestrates frontend, backend, and PostgreSQL
- [ ] `docker-compose up` starts a fully operational application
- [ ] No manual dependency installation required outside Docker
