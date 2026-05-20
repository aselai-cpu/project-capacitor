---
type: decision
title: 003 — Multi-stage Docker builds with Nginx frontend
created: 2026-05-20
status: accepted
---
# ADR-003: Multi-Stage Docker Builds with Nginx Frontend

## Context

Part 6 requires full containerization via docker-compose. Need to serve a React SPA, a Node.js backend, and PostgreSQL with a single `docker-compose up`.

## Decision

Use **multi-stage Docker builds** for both frontend and backend, with **Nginx** serving the compiled React SPA.

### Architecture
- **Backend Dockerfile:** Stage 1 (node:20-alpine) compiles TypeScript + generates Prisma client → Stage 2 (node:20-alpine) runs production with only compiled output
- **Frontend Dockerfile:** Stage 1 (node:20-alpine) builds React SPA → Stage 2 (nginx:1.25-alpine) serves static files with SPA fallback routing and `/api` proxy to backend
- **docker-compose.yml:** 3 services — `db` (postgres:15-alpine with healthcheck), `backend` (depends on healthy db, runs migrations + seed on startup), `frontend` (depends on backend)

### Ports
- PostgreSQL: 5432
- Backend API: 5000
- Frontend (Nginx): 3000 → 80

### Startup sequence
1. DB starts, healthcheck confirms `pg_isready`
2. Backend starts, runs `prisma db push && prisma db seed && node dist/index.js`
3. Frontend starts, proxies `/api` requests to backend:5000

## Consequences

- **Positive:** Single `docker-compose up --build` starts everything — zero manual setup
- **Positive:** Multi-stage builds keep production images small (no dev dependencies, no TypeScript compiler)
- **Positive:** Nginx handles SPA client-side routing (`try_files $uri /index.html`)
- **Trade-off:** Backend CMD chains migration + seed + server — if migration fails, container restarts. Could be improved with a separate init container.
- **Trade-off:** `GEMINI_API_KEY` must be provided via `.env` file or environment variable
