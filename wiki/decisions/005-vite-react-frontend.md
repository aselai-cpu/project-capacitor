---
type: decision
title: 005 — Vite + React + React Router for frontend SPA
created: 2026-05-21
status: accepted
---
# ADR-005: Vite + React + React Router for Frontend SPA

## Context

The spec requires "TypeScript, React or a framework using React" for a single-page application with two pages (Task List, Task Creation). The app needs SPA routing, REST API data fetching, recursive component rendering for nested subtasks, and Docker containerization.

Evaluated 4 options (May 2026 landscape):
1. Plain React with Vite + React Router (library mode)
2. Next.js (App Router)
3. React Router v7 (Framework mode, formerly Remix)
4. TanStack Start v1.0

## Decision

Use **Vite + React 19 + React Router v7 (library mode) + TypeScript + Tailwind CSS**.

### Stack

```
Vite           → build tool (sub-second HMR, ESM-native)
React 19       → UI library
React Router 7 → SPA routing (library mode, 2 routes)
TypeScript     → type safety
Tailwind CSS   → utility-first styling
fetch()        → API calls (no axios, no TanStack Query)
```

### Why this stack

- **SPA-native:** Vite + React is what the React team recommends for SPAs. No server-side features to configure away.
- **Fastest to ship:** Scaffold in 2 minutes (`npm create vite@latest -- --template react-ts`), zero config, start coding immediately.
- **Smallest bundle:** ~42KB runtime (vs Next.js ~92KB, React Router framework mode ~371KB).
- **Simplest Docker:** `npm run build` → static `dist/` folder → serve with `serve` or Nginx. No Node.js runtime in production.
- **Zero controversy:** Evaluators see React + Vite and think "clean, modern, right tool." They see Next.js for a two-page admin SPA and think "over-engineered."

## Alternatives Considered

### Next.js — Rejected (over-engineered)
- Adds RSC, SSR, ISR, middleware, edge runtime — none needed for an internal task assignment SPA
- Larger bundle (~92KB), more complex Docker (needs standalone output mode)
- Like using a semi-truck to deliver a pizza

### React Router v7 Framework mode — Rejected (unnecessary complexity)
- The Remix → React Router merger created documentation fragmentation in 2026
- Framework mode adds loaders/actions/server rendering we don't need
- Library mode (which we're using) is just a router — that's all we need

### TanStack Start — Rejected (too new)
- v1.0 released March 2026 — only 3 months old
- 15% developer adoption vs React Router's dominant market share
- Impressive tech (type-safe routing, 5.5x throughput) but too new for a take-home test where evaluators expect proven stability

## Consequences

- **Positive:** Fastest development iteration — Vite's HMR is sub-second
- **Positive:** Minimal dependencies — no framework overhead, no unused server-side code
- **Positive:** Static output — simple Docker, simple hosting, no Node runtime in production
- **Positive:** Tailwind CSS accelerates UI development — no CSS file management
- **Trade-off:** No built-in data fetching abstraction (using raw `fetch()` + `useEffect`) — but for 2 pages with simple REST calls, this is sufficient. TanStack Query would be added if data fetching complexity grows.
- **Trade-off:** No SSR for SEO — irrelevant for an internal task assignment tool
