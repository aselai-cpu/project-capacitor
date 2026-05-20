---
type: note
title: Research Papers — Summaries & Project Relevance
created: 2026-05-20
updated: 2026-05-20
---
# Research Papers — Summaries & Project Relevance

Papers referenced in [[wiki/notes/gemini-design-discussion]] across three pillars. Stored in `raw/papers/`.

## Pillar 1: LLMs in Requirements Engineering

### Paper 01: LLM in Software Requirement Engineering — Systematic Review
- **Source:** `[[raw/papers/01-llm-in-requirement-engineering.pdf]]`
- **Authors:** Hemmat, Sharbaf, Kolahdouz-Rahimi, Lano, Tehrani (2025)
- **Venue:** Frontiers in Computer Science, DOI: 10.3389/fcomp.2025.1519437
- **Summary:** Systematic mapping study of 29 primary studies (2020-2024) on LLMs in RE. Categorizes LLM types used (GPT dominates with 23 studies, followed by code-focused models at 14, BERT at 5, transformer-based at 10). Reviews input-output mechanisms and which RE stages benefit most.
- **Key findings:** GPT models excel at generating requirement documents, code snippets, and test cases. Fine-tuning (LoRA, prompt tuning) and few-shot prompting are the most effective optimization techniques. Key challenges: hallucination, domain-specific language, complex dependency handling.
- **Relevance to project:** Validates the [[wiki/requirements/part5-llm-skill-id|Part 5]] approach of using an LLM to classify task titles into skill categories. Suggests structured prompting with strict output format (JSON array) is well-supported by current research.

### Paper 02: AI-Generated User Stories — Are They Good Enough?
- **Source:** `[[raw/papers/02-ai-generated-user-stories.pdf]]`
- **Authors:** Santos, Steinmacher, Conte, Oran, Gadelha (2025)
- **Venue:** SBES '25 (September 2025, Recife, Brazil)
- **Summary:** Empirical study with 24 participants generating 457 user stories using the "US-Prompt" technique with GPT-4o Mini. Evaluated against QUS (Quality User Story) framework with 7 criteria. Overall success rate: 82.28% standard prompt, 87.24% modified prompt.
- **Key findings:** The US-Prompt method has 7 components: activity introduction, product vision, users/actions, template, quality criteria, few-shot examples, generation request. 87.5% of sets met >75% quality criteria. Participants rated ease of use highly (72.4% strongly agreed). Limitations: formatting inconsistencies, reliability concerns for critical tasks.
- **Relevance to project:** Informs prompt design for [[wiki/requirements/part5-llm-skill-id|Part 5]]. The structured prompt approach (system instruction + strict output format + examples) mirrors the US-Prompt pattern. The finding that few-shot examples improve quality supports including skill classification examples in the Gemini prompt.

## Pillar 2: Skill-Constrained Task Allocation

### Paper 03: Task Assignment System for Remote Work by Skill Matching
- **Source:** `[[raw/papers/03-task-assignment-skill-matching.pdf]]`
- **Authors:** Sukstrienwong, Pukdesree (2024)
- **Venue:** 6th TICEAS, Hokkaido, Japan (December 2024)
- **Summary:** Presents TASE (Task Assignment System for Employees), a web + mobile application for skill-based task allocation in remote work environments. Uses a matching score function combining primary and secondary skills with supervisor-defined importance weights.
- **Key findings:** The matching score `M(e,t)` evaluates employee-task fit using: primary skills (weighted by supervisor priority) + secondary skills (weighted lower). The system considers both hard skill match and relative importance. Compared favorably to manual assignment in efficiency and fairness.
- **Relevance to project:** Directly validates the [[wiki/entities/task|Task]]-to-[[wiki/entities/developer|Developer]] assignment constraint (Invariant A). Our implementation uses a simpler superset check (developer must have ALL required skills), but this paper shows the pattern can be extended with weighted scoring — relevant for the "Future Target State" in the README.

### Paper 04: Staffing and Scheduling Problems in Software Development
- **Source:** `[[raw/papers/04-software-project-staffing-problem.pdf]]`
- **Authors:** Peixoto, Mateus, Resende (2014)
- **Venue:** IEEE COMPSAC 2014, DOI: 10.1109/COMPSAC.2014.96
- **Summary:** SLR of 52 studies on Search-Based Software Project Management (SBSPM) for resource allocation and task scheduling. Identifies four core concepts in problem models: Task, Resource, Project, Skill. Analyzes optimization approaches and adoption challenges.
- **Key findings:** Most common optimization: evolutionary algorithms (56%), GA-based (33%). Core RSP concepts map directly to our domain: Task (48 studies), Resource/Developer (43), Project (20), Skill (14). Key gap: only 10% of studies consider skill levels changing over time. Only 2 articles reported use in real software organizations.
- **Relevance to project:** The UML conceptual model (Figure 2) maps almost 1:1 to our entity model: Resource → [[wiki/entities/developer|Developer]], Task → [[wiki/entities/task|Task]], Skill → [[wiki/entities/skill|Skill]]. Confirms our domain model is well-grounded in established research. The "Skill" concept with `name` and `level` attributes suggests our model could evolve to include proficiency levels.

## Pillar 3: Hierarchical State Governance

### Paper 05: Domain-Driven Design (Eric Evans, 2003)
- **Source:** `[[raw/papers/05-ddd-eric-evans.pdf]]` (sample chapters)
- **Authors:** Eric Evans (2003)
- **Publisher:** Addison-Wesley
- **Summary:** The foundational text on DDD. Key concepts: Ubiquitous Language, Model-Driven Design, Bounded Context, Entities, Value Objects, Aggregates, Repositories, Factories, Services. The building blocks diagram shows the relationships between these patterns.
- **Relevance to project:** The nested Task tree is modeled as a DDD **Aggregate** with the root Task as the **Aggregate Root** (see [[wiki/decisions/001-prisma-orm]]). All state changes (status updates, developer assignment) must respect the aggregate boundary. The three bounded contexts (Capability, Execution, Cognitive) from [[wiki/notes/gemini-design-discussion]] derive directly from Evans' patterns.

### Paper 06: HTN Planning with Task Insertion and State Constraints
- **Source:** `[[raw/papers/06-htn-planning-task-insertion-state-constraints.pdf]]`
- **Authors:** Xiao, Herzig, Perrussel, Wan, Su (2017)
- **Venue:** IJCAI-17
- **Summary:** Extends hierarchical task network (HTN) planning with state constraints (TIHTNS). State constraints capture pre- and postconditions of compound tasks. A compound task is "accomplished if its subtasks are accomplished." Proves the extension doesn't increase plan-existence complexity (stays 2-NEXPTIME-complete).
- **Key findings:** State constraints formalize exactly the kind of rule our project needs: a parent task state depends on children states. The "maintenance" constraint (a formula must hold throughout all subtask states) maps to our status cascade rule. The paper also shows TIHTNS covers both HTN and hierarchical goal network planning.
- **Relevance to project:** Provides formal theoretical grounding for [[wiki/requirements/part4-subtasks|Part 4]]'s status cascade rule: "a Task can only be marked Done if all subtasks are Done." In HTN terms, the parent task's postcondition (status=Done) requires all child tasks to have achieved their postcondition first. Validates that our application-layer enforcement approach (checking subtask statuses before allowing parent transition) is a sound simplification of the formal model.

### Paper 06b: Structural Complexity Analysis of HTN Planning
- **Source:** `[[raw/papers/06b-structural-complexity-htn-planning.pdf]]`
- **Authors:** Brand, Ganian, Mc Inerney, Wietheger (2025)
- **Venue:** arXiv:2401.14174v2
- **Summary:** Refined complexity analysis of three HTN problems: Plan Verification, Plan Existence, State Reachability. Identifies polynomial-time solvable cases based on structural properties (generalized partial order width). Establishes algorithmic meta-theorem for lifting tractability from primitive to compound networks.
- **Key findings:** All three problems are NP-hard even on simple tree-like networks. However, polynomial-time algorithms exist for networks of bounded "generalized partial order width." The task hierarchy decomposition concept maps to our recursive subtask tree.
- **Relevance to project:** Theoretical confirmation that hierarchical task structures are computationally hard in general, but our specific case (simple parent-child status checks) is a tractable special case. No need for complex planning algorithms — our application-layer recursive check is sufficient.
