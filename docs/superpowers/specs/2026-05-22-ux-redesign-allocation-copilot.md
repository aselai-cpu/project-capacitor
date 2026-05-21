# Capacitor UX Redesign: AI-Assisted Allocation Copilot

## Problem Statement

Capacitor's primary purpose is AI-assisted task allocation — matching developers to tasks based on skill fit. However, the current UI buries this capability across 4 disconnected pages with no guided workflow. A project manager must navigate 8 steps across multiple screens to complete a single allocation, and the AI recommendation is hidden behind a tiny emoji button visible only on unassigned tasks.

The app needs to make its core value proposition — "AI helps you assign the right developer to every task" — unmissable and central to the experience.

## Target Persona

**Project Manager** performing initial task assessment and developer allocation. They:
- Onboard developers (once, at project start)
- Create projects and generate tasks
- Allocate tasks to developers based on skill fit and workload
- Track progress across projects

Their primary job-to-be-done: **"assign every task to the best-fit developer, quickly and confidently."**

## Design Decisions

### 1. Navigation Restructure

**Current:** `Projects | Tasks | Developers` — flat, workflow-agnostic, defaults to Projects.

**New:** `Dashboard | Team | Projects | Tasks | Allocate`

| Nav Item | Purpose | Badge |
|----------|---------|-------|
| Dashboard | Home page — metrics, CTA, workload overview | — |
| Team | Developer onboarding and skill profiles (was "Developers") | — |
| Projects | Project management, AI enrichment, story generation | — |
| Tasks | Task list with filters (project/status/assignee) | Count of unassigned tasks |
| Allocate | **Primary CTA** — AI allocation copilot with 3 views | Count of unassigned tasks |

- "Allocate" gets distinct visual treatment (purple/accent background) to signal it's the primary action
- "Developers" renamed to "Team" — matches PM mental model
- Navigation order follows the natural workflow: setup (Team, Projects) → work (Tasks, Allocate)
- Default route changes from `/projects` to `/dashboard`

### 2. Dashboard (New Page: `/dashboard`)

A home page that answers: "What needs my attention?"

**Components:**
- **Metric cards** (top row): Active Projects, Unassigned Tasks, Team Members, In Progress — four cards showing key numbers at a glance
- **Allocation CTA banner**: Purple gradient banner — "N tasks need developers. AI has pre-scored matches for your team." with "Start Allocating →" button linking to `/allocate`
- **Projects summary** (bottom left): List of projects with unassigned task counts, linking to project detail
- **Team workload** (bottom right): Horizontal bar chart showing each developer's current task count — visual capacity indicator

**Data source:** New `GET /api/dashboard` endpoint returning aggregated counts from existing models. No new database tables needed.

### 3. Allocation Page (New Page: `/allocate`)

The core screen. Three switchable views of the same data — all unassigned tasks and all available developers with AI-computed match scores.

**Shared elements (all views):**
- View switcher tabs: Matrix | Kanban | Focus
- Project filter dropdown (All Projects / specific project)
- Task count indicator ("5 unassigned tasks")

#### 3a. Matrix View

Tasks as rows, developers as columns. Each cell shows a match percentage with color coding:
- **Green (100%):** Full match — developer has all required skills. **Clickable for assignment.**
- **Yellow (50-99%):** Partial match — some skill overlap. **Informational only** (greyed out, not clickable). Hover shows which skills are missing.
- **Red (<50%):** Weak match — significant skill gaps. **Informational only.**

**Important: The existing skill superset guard (Invariant A) is preserved.** Only developers with 100% skill coverage can be assigned. Yellow/Red cells explain *why* a developer isn't eligible — this is valuable context for the PM (e.g., "Bob is 80% match, only missing GraphQL — maybe worth upskilling"). The matrix makes the constraint visible rather than hiding it behind a 422 error.

AI's top pick per row gets a bold glow treatment (among the 100% matches, broken by lowest current task count). Developer column headers show current task count (workload indicator).

**Interaction:** Click a green cell to assign. On click, show a confirmation popover with the AI's one-line reasoning before committing. Yellow/Red cells show a tooltip on hover explaining the skill gap.

#### 3b. Kanban View

Board layout with columns:
- **Unassigned** (leftmost) — all unassigned tasks, each showing top 2 AI-recommended developers as small badges with match percentages
- **One column per developer** — shows their currently assigned tasks with status indicators

**Interaction:** Drag a task card from Unassigned to a developer column to assign. On drop, show the same confirmation popover as Matrix view (consistency). If the developer lacks required skills (fails Invariant A), the drop is rejected with a toast explaining which skills are missing. The card shows skill badges so the PM can visually verify the match before dragging.

**Assignment mechanism:** Drop triggers `PATCH /api/tasks/:id` with `{ developerId }` — same endpoint used by the existing TaskRow component. The skill superset guard applies identically.

#### 3c. Focus View (Split Panel)

Left panel: scrollable list of unassigned tasks. Right panel: when a task is selected, shows the **top 3 eligible developers** (100% skill match only) ranked by AI recommendation:
- Developer name and current workload
- Match percentage and skill overlap visualization
- AI-generated reasoning (one paragraph) — **loaded lazily**: show a skeleton/spinner per developer card, fire `POST /api/allocate/reason` for each. Responses are cached client-side for the session (same task+developer pair won't re-fetch).
- "Assign" button (triggers `PATCH /api/tasks/:id` with confirmation)

If fewer than 3 developers have 100% skill match, show all eligible developers. If zero are eligible, show an explanation: "No developer has all required skills" with a breakdown of what's missing.

This view gives the deepest context per match — useful when the PM wants to understand *why* the AI recommends someone.

**Data source:** The `GET /api/allocate/scores` endpoint returns match scores for all unassigned tasks against all developers, optionally filtered by project. Scoring is deterministic (skill overlap percentage — no LLM needed). LLM-generated reasoning is fetched on-demand per task-developer pair via `POST /api/allocate/reason` when the Focus view renders a developer card.

### 4. Task Creation — AI-First Skill Classification

**Current:** 46+ flat skill toggle buttons on the create form. PM must manually select skills.

**New behavior:**
1. PM types the task title (and optional acceptance criteria)
2. On title blur or after a 1-second debounce, the frontend calls `POST /api/tasks/classify-skills` (new endpoint) with `{ title, acceptanceCriteria? }`. A small spinner appears below the title while the LLM processes.
3. On success, AI-classified skills appear as green badges: "AI classified: React, Node.js, TypeScript". On LLM failure/timeout, badges are not shown and the form falls back to manual selection (no error shown — fail silently).
4. A collapsed "Refine skills manually" section can be expanded to show categorized skill toggles for override. The AI-classified skills are pre-selected.
5. The existing server-side classification in `createTask()` (`collectNodesWithoutSkills` logic) is **kept as a fallback** — if a task is submitted with no skills and the preview didn't fire, the server classifies on save as it does today.

**Skill categories** (frontend-only display grouping, no DB changes):
- **Languages:** TypeScript, Python, Java, Go, Rust, JavaScript, SQL
- **Frameworks:** React, Angular, Vue, Node.js, Flask, FastAPI, Spring Boot, React Native
- **Infrastructure:** Docker, Kubernetes, AWS, AWS Lambda
- **Data:** PostgreSQL, MongoDB, Redis, Neo4j, Elasticsearch
- **Tools:** Git, GraphQL, Jest, JUnit, Cypress, Jira, Figma
- **AI/ML:** LangChain, OpenAI API, Amazon Bedrock, Amazon Textract, OCR, RAG

Non-technical skills (Communication, Collaboration, Pair Programming, Agile, TDD) are **excluded from task skill selectors** but remain visible on developer profiles. These are valuable for team composition but not for task-skill matching.

### 5. "Team" Page Improvements (was "Developers")

- Rename nav link and page heading from "Developers" to "Team"
- No other functional changes — the recent Developer CRUD work (create, edit, delete, CV upload) is sufficient

### 6. Existing Pages — Minor Adjustments

- **TaskListPage:** Empty state text changes from "No tasks match the current filters" to context-aware: "No tasks yet. Create one to get started." (when unfiltered and empty) vs "No tasks match the current filters." (when filtered)
- **ProjectDetailPage:** "View all tasks →" link already works with project filter (implemented). No changes needed.

## Backend Changes

### New Endpoints

#### `GET /api/dashboard`

Returns aggregated metrics for the dashboard:

```typescript
interface DashboardResponse {
  activeProjects: number;       // count of projects with at least 1 task in TODO or IN_PROGRESS status
  unassignedTasks: number;      // count of tasks with no developerId
  teamMembers: number;          // count of developers
  inProgressTasks: number;      // count of tasks with status IN_PROGRESS
  projects: Array<{
    id: string;
    name: string;
    unassignedCount: number;
  }>;
  workload: Array<{
    developerId: string;
    developerName: string;
    taskCount: number;
  }>;
}
```

#### `GET /api/allocate/scores?projectId=<optional>`

Computes match scores for **unassigned tasks only** (where `developerId IS NULL`) against all developers. Pure read — no side effects.

```typescript
// Query params: ?projectId=uuid (optional — filter to a specific project)

// Response
interface ScoreResponse {
  tasks: Array<{
    taskId: string;
    taskTitle: string;
    taskSkills: string[];        // skill names (not IDs) for display
    scores: Array<{
      developerId: string;
      developerName: string;
      matchPercent: number;       // 0-100, deterministic skill overlap
      missingSkills: string[];    // skill names the developer lacks (for tooltip on yellow/red cells)
      currentTaskCount: number;
      isTopPick: boolean;
    }>;
  }>;
}
```

Match percentage calculation (deterministic, no LLM needed):
- If task has no skills: all developers score 100%
- Otherwise: `(overlapping skills / required skills) * 100`
- Top pick: highest score, ties broken by lowest current task count

#### `POST /api/allocate/reason`

On-demand LLM reasoning for a specific task-developer pair (used by Focus view):

```typescript
// Request
interface ReasonRequest {
  taskId: string;
  developerId: string;
}

// Response
interface ReasonResponse {
  reason: string;  // 1-2 sentence AI explanation
}
```

#### `POST /api/tasks/classify-skills`

Real-time AI skill classification preview for the task creation form:

```typescript
// Request
interface ClassifyRequest {
  title: string;
  acceptanceCriteria?: string;
}

// Response
interface ClassifyResponse {
  skillIds: string[];     // IDs of matched skills in the database
  skillNames: string[];   // names for display
}
```

Uses the existing `classifySkills()` function from `llmService.ts`, passing both `title` and `acceptanceCriteria` (concatenated) to give the LLM more context. The `classifySkills` function signature needs a minor update to accept an optional `context` parameter in addition to `title`. Timeout: same `LLM_TIMEOUT_MS` as existing classification. On timeout, returns empty arrays (frontend falls back to manual selection).

### Nav Badge Data Strategy

The nav badge (unassigned task count) appears on every page load. To avoid fetching all tasks just for a count:
- **Endpoint:** Reuse `GET /api/dashboard` — the `unassignedTasks` field provides the count
- **Fetch strategy:** NavBar calls the dashboard endpoint on mount and caches the result in React state. The count refreshes when navigating between pages (NavBar re-renders). No polling.
- **Staleness is acceptable** — the badge is a hint, not a real-time counter. It updates on every navigation.

### Skill Category Mapping

Frontend-only constant — no database or API changes:

```typescript
const SKILL_CATEGORIES: Record<string, string[]> = {
  'Languages': ['TypeScript', 'Python', 'Java', 'Go', 'Rust', 'JavaScript', 'SQL'],
  'Frameworks': ['React', 'Angular', 'Vue', 'Node.js', 'Flask', 'FastAPI', 'Spring Boot', 'React Native'],
  'Infrastructure': ['Docker', 'Kubernetes', 'AWS', 'AWS Lambda'],
  'Data': ['PostgreSQL', 'MongoDB', 'Redis', 'Neo4j', 'Elasticsearch'],
  'Tools': ['Git', 'GraphQL', 'Jest', 'JUnit', 'Cypress', 'Jira', 'Figma'],
  'AI/ML': ['LangChain', 'OpenAI API', 'Amazon Bedrock', 'Amazon Textract', 'OCR', 'RAG'],
};
const NON_TECHNICAL_SKILLS = ['Communication', 'Collaboration', 'Pair Programming', 'Agile', 'TDD'];
```

Skills not in any category are placed in a visible **"Other"** group at the bottom of the categorized list — these are still selectable on task forms since they may be legitimate technical skills created via CV upload (e.g., "Next.js", "Terraform"). Non-technical skills (from `NON_TECHNICAL_SKILLS` list) are shown on developer profiles but filtered out of task skill selectors entirely.

## New Frontend Routes

```
/dashboard          → DashboardPage (NEW — default route)
/team               → TeamPage (renamed from /developers)
/team/:id           → DeveloperProfilePage (renamed from /developers/:id)
/projects           → ProjectListPage (unchanged)
/projects/new       → ProjectCreatePage (unchanged)
/projects/:id       → ProjectDetailPage (unchanged)
/tasks              → TaskListPage (unchanged)
/tasks/new          → TaskCreatePage (modified — AI-first skills)
/allocate           → AllocationPage (NEW)
*                   → Navigate to /dashboard (was /projects)
```

Old `/developers` and `/developers/:id` routes should redirect to `/team` and `/team/:id` for backward compatibility.

**Rename ripple scope:** The route change from `/developers` to `/team` requires updating:
- `NavBar.tsx` — link href and label
- `DeveloperListPage.tsx` — page heading text ("Team" not "Developers")
- `DeveloperProfilePage.tsx` — back link text and href
- `App.tsx` — route paths + redirect rules
- Any `navigate('/developers')` calls (e.g., delete handler in DeveloperProfilePage)
- Component file names are NOT renamed (DeveloperListPage stays DeveloperListPage) — the "Team" rename is cosmetic, not structural.

## UX Heuristics Applied

| Nielsen Heuristic | How Applied |
|-------------------|-------------|
| Visibility of system status | Dashboard metrics, nav badges, workload bars |
| Match between system and real world | "Team" not "Developers", workflow-ordered nav |
| User control and freedom | 3 allocation views, manual skill override |
| Consistency and standards | Color-coded scores (green/yellow/red), uniform card patterns |
| Recognition rather than recall | Matrix view shows all matches at a glance |
| Flexibility and efficiency of use | Matrix for overview, Focus for deep analysis |
| Aesthetic and minimalist design | AI-first skills (collapsed override), grouped categories |
| Help users recognize and recover | Confirmation popover before assignment |

## Out of Scope

- Drag-and-drop implementation details (library choice: react-beautiful-dnd vs dnd-kit)
- Real-time updates / WebSocket support
- Role-based access control (all users are PMs for now)
- Notification system
- Mobile/responsive layout
- Undo assignment
- Batch assignment (assign multiple tasks in one click)
