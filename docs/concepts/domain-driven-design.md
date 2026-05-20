# About the Domain Model

This document explains how Project Capacitor's domain is structured using Domain-Driven Design (DDD) principles, why the boundaries are drawn where they are, and what constraints govern the system's behavior.

## The Problem This Domain Solves

On the surface, Capacitor is a task assignment application. But the core problem it addresses is deeper: **Skill-Constrained Resource Allocation with Hierarchical Dependency Management and Automated Governance.**

Three specific organizational breakdowns motivate the design:

1. **Competency Gap (Misallocation Risk):** Standard task trackers let any user be assigned to any task. In engineering teams, this leads to mismatches — a frontend task assigned to a backend-only developer. Capacitor enforces a capability guard at the domain level.

2. **Structural Integrity Cascading:** Complex objectives decompose into nested subtasks. If a parent task is marked "Done" while its subtasks are incomplete, the system state becomes inconsistent. Capacitor enforces a status cascade rule: a parent cannot be completed until all its children are completed.

3. **Semantic Friction:** Manually tagging every task with the correct technical skills is error-prone and tedious. Capacitor automates this by using an LLM to classify task titles into skill categories, reducing metadata rot.

These three problems map directly to the three bounded contexts in the domain model.

## Bounded Contexts

The domain is partitioned into three bounded contexts, each with a clear responsibility and a well-defined interface to the others.

### Capability Context (Resource Domain)

**Responsibility:** Tracks what human actors can do.

**Entities:**
- **Developer** — A named human actor with a set of technical skills (e.g., Alice has Frontend; Carol has Frontend and Backend).
- **Skill** — A named technical capability (e.g., "Frontend", "Backend"). Skills are shared — multiple developers can possess the same skill.

**Relationship:** Developer and Skill have a many-to-many relationship. A developer can have multiple skills, and a skill can belong to multiple developers.

**Key characteristic:** This context is largely static. Developers and skills are seeded at startup and rarely change during operation. The Capability Context is consulted by the Execution Context when validating task assignments.

### Execution Context (Work Management Domain)

**Responsibility:** Manages the lifecycle of work items — creation, decomposition, assignment, and completion.

**Entities:**
- **Task** — The central domain entity. A task has a title (typically in user story format), a status (To-do, In Progress, Done), zero or more required skills, an optional assignee (Developer), and zero or more subtasks (child Tasks).

**The Task Aggregate:** A task with its entire subtask tree forms a DDD *Aggregate*. The top-level task is the *Aggregate Root*. This is the most important structural decision in the domain model, because:

- All state changes to the tree must respect the aggregate's invariants (see below).
- The subtask relationship is self-referencing — a subtask has the same properties as a task, enabling arbitrary nesting depth.
- When a tree of tasks is created, the entire tree is committed atomically in a single database transaction. There is no state where a parent exists without its children, or vice versa.

**Relationship to Capability Context:** When a developer is assigned to a task, the Execution Context queries the Capability Context to verify the developer possesses all required skills. This is the Capability Superset Rule (Invariant A).

### Cognitive Context (Intelligence Domain)

**Responsibility:** Bridges unstructured human language and structured domain constraints.

**Mechanism:** When a task is created without explicitly specified skills, the Cognitive Context intercepts the creation flow. It sends the task title to an LLM, which classifies it into one or more skills (Frontend, Backend, or both). The predicted skills are then attached to the task before it is persisted.

**Key characteristic:** This context is a *bridge* — it translates between the human-facing input (natural language task titles) and the machine-facing constraints (the skill taxonomy). It has no persistent state of its own. It is invoked synchronously during task creation and operates in parallel when multiple tasks in a tree need classification.

**Relationship to Execution Context:** The Cognitive Context enriches task data before it enters the Execution Context's persistence layer. If the LLM fails or times out, the task is still created — just without skills. The system degrades gracefully rather than blocking core functionality on an external service.

## Domain Invariants

Two invariants govern the system's correctness. Both are enforced in the application service layer, not in the database.

### Invariant A: Capability Superset Rule

> A Task can only be assigned to a Developer whose skills are a superset of the Task's required skills.

Formally: `Developer.skills ⊇ Task.requiredSkills`

If a task requires [Frontend, Backend], only a developer with *both* Frontend and Backend skills can be assigned. A developer with only Frontend would be rejected with a 422 response.

This invariant is checked at assignment time (PATCH endpoint), not at task creation time. A task can exist without an assignee — the invariant only fires when someone attempts to set one.

### Invariant B: Hierarchical State Cascade Rule

> A Task can only transition to "Done" if all of its subtasks have status "Done".

This invariant is checked when a status update to DONE is requested. If the task has subtasks and any of them are not Done, the transition is rejected with a 400 response.

All other status transitions (To-do → In Progress, In Progress → Done, Done → To-do, etc.) are unrestricted. The cascade rule is the *only* status constraint.

Notably, adding a new subtask to a Done parent does **not** auto-regress the parent's status. The parent remains Done, but it cannot be re-marked Done (if its status is later changed) until the new subtask is also completed. The invariant is enforced on *entry to Done*, not as a continuous constraint.

## Ubiquitous Language

These terms have precise meanings within the domain:

| Term | Definition |
|------|-----------|
| **Task** | A unit of work with a title, status, required skills, optional assignee, and optional subtasks. The Aggregate Root when it has children. |
| **Subtask** | A Task that is a child of another Task. Structurally identical to a Task — same properties, same rules. |
| **Developer** | A human actor who can be assigned to tasks. Has a name and a set of skills. |
| **Skill** | A named technical capability (e.g., "Frontend", "Backend"). Shared across developers and tasks. |
| **Assignment** | The act of linking a Developer to a Task. Guarded by Invariant A. |
| **Status** | The lifecycle state of a Task: To-do, In Progress, or Done. Transition to Done is guarded by Invariant B. |
| **Skill Classification** | The automated process of identifying required skills from a task title using an LLM. Performed by the Cognitive Context. |
| **Task Tree** | A root task and all its nested subtasks. Created atomically. Forms a DDD Aggregate. |

## Entity Relationship Model

```
Developer ──M:N──── Skill
    │                  │
    │ 0..1:N           │ M:N
    │                  │
    ▼                  ▼
  Task ───────────── Skill
    │
    │ self-referencing (parent → children)
    ▼
  Task (subtask)
    │
    ▼
  Task (sub-subtask)
    ...
```

**Developer → Task:** One-to-many. A developer can be assigned to multiple tasks, but a task has at most one assignee.

**Developer ↔ Skill:** Many-to-many. A developer can have multiple skills; a skill can belong to multiple developers.

**Task ↔ Skill:** Many-to-many. A task can require multiple skills; a skill can be required by multiple tasks.

**Task → Task (subtask):** Self-referencing one-to-many. A task can have many child tasks. A child task has exactly one parent (or null for root tasks). Nesting depth is unbounded.

## How the Contexts Interact

The typical flow during task creation illustrates how the three contexts collaborate:

1. **User submits a task tree** (Execution Context receives the request)
2. **Cognitive Context enriches** — walks the tree, finds nodes without skills, classifies them via LLM in parallel
3. **Execution Context persists** — transforms the enriched tree into a Prisma nested write and commits atomically
4. **Later, user assigns a developer** — Execution Context validates against Capability Context (Invariant A)
5. **Later, user marks task Done** — Execution Context checks Invariant B against the task's subtree

The Capability Context is passive — it provides data but doesn't initiate actions. The Cognitive Context is transient — it operates during creation and has no persistent state. The Execution Context is the orchestrator — it owns the task lifecycle and enforces both invariants.

## Why These Boundaries

The three-context model was chosen because each context has a fundamentally different *rate of change* and *reason to change*:

- **Capability Context** changes when the organization hires, fires, or retrains developers. This is infrequent — days to weeks.
- **Execution Context** changes with every task creation, status update, and assignment. This is frequent — minutes to hours.
- **Cognitive Context** changes when the LLM provider, model, or prompt changes. This is operational — independent of domain logic.

Separating them means a change to the LLM integration (switching from Gemini to OpenAI, for example) doesn't touch the task assignment logic. A change to the skill taxonomy doesn't require retraining the LLM. And a change to the task status workflow doesn't affect how developers are modeled.

## What This Model Doesn't Cover (Future Considerations)

The current model treats skills as binary — a developer either has a skill or doesn't. The Gemini design discussion explored extending this to:

- **Proficiency levels** (Novice, Competent, Expert) on the Developer-Skill relationship
- **Skill vectors** replacing the simple many-to-many with weighted, multi-dimensional capability profiles
- **Growth assignments** where tasks slightly beyond a developer's current profile are flagged for senior oversight

These extensions would transform the Capability Context from a static lookup to a dynamic assessment engine. They are documented as future improvements but deliberately excluded from the current implementation to maintain focus on the core invariants.
