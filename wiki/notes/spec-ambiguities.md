---
type: note
title: Top 5 Spec Ambiguities & Recommended Assumptions
created: 2026-05-21
updated: 2026-05-21
---
# Top 5 Spec Ambiguities & Recommended Assumptions

Analysis of the [[raw/Software Engineering Take Home Test v2.0.pdf|HTX take-home spec]] from a solution architect perspective. Ranked by implementation risk. Each ambiguity includes the recommended assumption to document in the README.

## 1. Status values are undefined — "To-do", "Done", etc.

**The ambiguity:** The spec says a Task can have status "To-do", "Done", etc. The "etc." is undefined. No state machine or transition rules are specified beyond the cascade constraint.

**Open questions:**
- What are the valid statuses? Binary (To-do/Done) or workflow (To-do → In Progress → Done)?
- Can status go backwards (Done → To-do)?
- If a parent is Done and a new subtask is added, does the parent auto-regress?
- The wireframe dropdown implies multiple options but only shows "To-do"

**Recommended assumption:** Implement a `TaskStatus` enum with `TODO`, `IN_PROGRESS`, `DONE`. The cascade rule (from [[wiki/requirements/part4-subtasks|Part 4]]) only constrains entering Done — all other transitions are unrestricted. Adding a subtask to a Done parent does NOT auto-regress the parent status. Justify in README that "etc." was interpreted as an extensible enum.

**Affects:** [[wiki/entities/task|Task entity]], [[wiki/requirements/part1-database|Part 1 schema]], [[wiki/requirements/part2-backend-api|Part 2 API]]

---

## 2. Task List Page — does it show subtasks, and how?

**The ambiguity:** Part 3 says "All existing Tasks and their relevant attributes should be listed." Part 4 adds subtasks. The wireframe shows a flat table with no nesting.

**Open questions:**
- Does "all existing Tasks" include subtasks, or only root-level tasks?
- If subtasks shown, are they nested/indented or flat with a parent reference?
- Can subtasks be assigned/status-changed directly from the Task List page?
- The wireframe has an ellipsis column ("...") between Skills and Status — what goes there?

**Recommended assumption:** Show root tasks as top-level rows. Allow expanding to reveal subtasks inline with visual indentation (tree-table pattern). All tasks including subtasks support status/assignee dropdowns on the list page. The "..." column is interpreted as indicating additional columns may exist — ignore for MVP.

**Affects:** [[wiki/requirements/part3-frontend|Part 3 frontend]], [[wiki/requirements/part4-subtasks|Part 4 subtasks]], [[wiki/requirements/part2-backend-api|Part 2 API response shape]]

---

## 3. Subtask creation — only on Create page, or also on List page?

**The ambiguity:** Part 4.3 says "Modify the Task creation page such that the Task creation page supports the creation of subtasks." The wireframe only shows subtask creation at initial creation time. No edit/update flow is specified.

**Open questions:**
- Can subtasks be added to existing tasks from the Task List page?
- If only at creation time, how do you add a subtask to a task created yesterday? There's no "Edit Task" page in the spec.
- The wireframe shows no "Add Subtask" action on the Task List page.

**Recommended assumption:** Allow subtask creation both at initial creation (Part 4.3 wireframe) AND on the Task List page via an "Add Subtask" action per row. Without this, the system is impractical — you can never decompose work after initial planning. Justify in README as a necessary UX extension. Alternatively, take the conservative approach: subtasks only at creation time, strictly following the spec letter.

**Affects:** [[wiki/requirements/part3-frontend|Part 3 frontend]], [[wiki/requirements/part4-subtasks|Part 4 subtasks]], [[wiki/requirements/part2-backend-api|Part 2 API]] (needs a POST endpoint for adding subtasks to existing tasks)

---

## 4. LLM skill identification — synchronous or asynchronous?

**The ambiguity:** Part 5.3 says skills are "automatically generated using LLM on the backend" when a task is created without skills. No timing, error handling, or UX flow is specified.

**Open questions:**
- Synchronous (block POST response until LLM returns) or asynchronous (return 201 immediately, fill in skills later)?
- If synchronous: what's the timeout? LLM calls can take 2-10 seconds.
- If asynchronous: how does the frontend know when skills are populated? Polling? WebSocket?
- What happens if the LLM call fails? Create with no skills? Retry? Block creation?
- Does the user see the LLM-predicted skills before the task is saved, or only after?

**Recommended assumption:** Synchronous with a timeout fallback. The POST /api/tasks call waits for LLM classification (typically <2s with Gemini Flash / GPT-4o-mini). If the LLM fails or times out (5s), create the task with empty skills and log a warning — the task remains functional, just unclassified. This aligns with [[wiki/decisions/004-vercel-ai-sdk|ADR-004]]'s `generateObject()` approach. Justify in README.

**Affects:** [[wiki/requirements/part5-llm-skill-id|Part 5]], [[wiki/requirements/part2-backend-api|Part 2 API]], [[wiki/decisions/004-vercel-ai-sdk|ADR-004]]

---

## 5. API granularity — single task or list endpoints?

**The ambiguity:** Part 2 says "A Task and all its relevant properties can be read" and "A Developer and all their relevant properties can be read." It's unclear whether this means single-resource endpoints, list endpoints, or both.

**Open questions:**
- Single-resource (`GET /api/tasks/:id`) or list (`GET /api/tasks`), or both?
- Does "all relevant properties" include nested subtasks? Recursively? To what depth?
- Does "relevant properties" on a Developer include their assigned tasks, or just name + skills?
- Any filtering, pagination, or sorting? The Task List page implies a list, but unbounded recursive responses are a performance concern.

**Recommended assumption:** Implement both:
- `GET /api/tasks` — list all root tasks with immediate subtasks (one level deep), plus skills and assignee
- `GET /api/tasks/:id` — single task with full recursive subtask tree
- `GET /api/developers` — list all developers with skills and assigned task IDs (not full task objects, to avoid circular references)
- `GET /api/skills` — list all skills

No pagination for MVP (seed data is small). Justify in README that pagination would be added for production scale.

**Affects:** [[wiki/requirements/part2-backend-api|Part 2 API]], [[wiki/requirements/part3-frontend|Part 3 frontend]] (data fetching strategy)
