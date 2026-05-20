---
type: note
title: Devil's Advocate — Top 5 Blind Spots & Course Corrections
created: 2026-05-21
updated: 2026-05-21
---
# Devil's Advocate — Top 5 Blind Spots & Course Corrections

Critical self-review of our architecture decisions, proposed solutions, and overall approach. Each blind spot includes the damage it causes and the concrete fix.

## 1. Research Wiki Instead of Application Code

**The blind spot:** 4 ADRs, 11 research papers, 17 wiki pages, ambiguity analysis, solution proposals — and zero lines of application code. This is a 3-day take-home test.

**The damage:**
- Every hour on wiki pages is an hour not spent on implementation
- The spec evaluates "software engineering best practices and high code quality" — that means *code*
- An evaluator running `docker-compose up` and seeing a working app with clean code scores higher than a comprehensive wiki with a half-finished app
- DDD/TOGAF framing is impressive in the README but academic theater if the code doesn't work

**Fix:** Stop wiki work. Start implementation immediately. Document as we go. The wiki should grow alongside code, not precede it.

**Lesson:** Architecture documentation has diminishing returns. The first 20% of design captures 80% of the value. We're deep into the diminishing tail.

---

## 2. Recursive Payload + Synchronous LLM = Multiplicative Latency Bomb

**The blind spot:** [[wiki/decisions/002-recursive-task-payload|ADR-002]] (atomic tree POST) and [[wiki/notes/ambiguity-solutions|Solution #4]] (synchronous LLM with 5s timeout) were designed independently and never stress-tested together.

**The math:**
The `enrichTaskTreeWithSkills()` function from [[wiki/notes/gemini-design-discussion]] traverses the tree **sequentially**. If a user creates a tree with 8 nodes and 5 have no skills:

```
5 LLM calls × 1-2s each = 5-10 seconds blocking
5 LLM calls × 5s timeout  = up to 25 seconds worst case
```

The user clicks Save and stares at a spinner for 10+ seconds. The evaluator notices.

**Fix:** Parallelize LLM calls with `Promise.all()` across all skill-less nodes:

```typescript
const nodesToEnrich = collectNodesWithoutSkills(tree);
await Promise.all(nodesToEnrich.map(node => classifyWithLLM(node)));
```

This reduces latency to ~2s regardless of tree size (one LLM round-trip, parallelized). The nodes are independent — no data dependency between them.

**Lesson:** Decisions made in isolation must be integration-tested. The payload design is elegant for DB writes but breaks when combined with sequential external calls.

---

## 3. Three-State FSM Adds a Restriction the Spec Never Asked For

**The blind spot:** Our TODO → DONE block (must pass through IN_PROGRESS) is an *invented constraint* that contradicts the spec's wireframe and will confuse evaluators.

**The spec says:** "A Task can have status 'To-do', 'Done', etc." The wireframe shows a status dropdown. Nowhere does it restrict direct transitions.

**The scenario that breaks:** Evaluator creates a simple task with no subtasks. Tries to mark it Done from the dropdown. System forces them through In Progress first. They think it's a bug.

**What we confused:** "Good UX in a production product" with "what this test evaluates." The evaluators are testing the skill-constrained assignment guard and the subtask cascade rule — not a state machine. Adding IN_PROGRESS and transition guards is scope creep that introduces bugs for zero evaluation credit.

**Fix:** Implement all three states (TODO, IN_PROGRESS, DONE) but allow ALL transitions freely. Only enforce one guard: the cascade check on entry to DONE (subtasks must all be Done). Don't block any transitions the spec doesn't explicitly restrict.

**Lesson:** Constraints should come from the spec, not from our architectural taste. Every invented rule is a potential evaluator frustration point.

---

## 4. Explicit Join Tables and Multi-Provider Abstraction Are YAGNI

**The blind spot:** Two ADRs justify decisions based on future requirements that don't exist.

### ADR-001: Explicit join tables
Justification: "future extensibility (e.g., adding proficiency metadata)"

Reality: There is no proficiency feature. Prisma's implicit many-to-many generates identical tables with zero boilerplate. Every query touching skills now requires manually joining through `DeveloperSkill` / `TaskSkill` models instead of Prisma's clean `include: { skills: true }`. We can migrate to explicit tables in 10 minutes if needed.

### ADR-004: Three provider adapters
Justification: "evaluators may have different API keys"

Reality: The spec says "Feel free to use any LLM provider such as Gemini." They're testing API integration, not abstraction. We're installing `ai` + `@ai-sdk/google` + `@ai-sdk/openai` + `@ai-sdk/anthropic` + `zod` for something that needs one SDK. The evaluator sees 5 dependencies in `package.json` and thinks "over-architect."

**Fix:**
- Use Prisma **implicit** many-to-many (`skills Skill[]` on both models). Simpler queries, less code.
- Install `ai` + `@ai-sdk/google` only. One provider. Add others only if time permits. The Vercel AI SDK is still a good choice — just don't install adapters you won't use.

**Lesson:** "Future extensibility" in a 3-day take-home test is a liability, not an asset. YAGNI means *actually* not building it, not just acknowledging the principle while doing it anyway.

---

## 5. Tree-Table UI Will Consume Half the Frontend Budget

**The blind spot:** Our proposed Task List (expandable tree-table with lazy loading, URL-persisted expand state, depth capping, chevron toggles, inline subtask creation) is 8-12 hours of frontend work.

**The spec's wireframe shows:** A flat table. Four columns. Dropdowns.

**What the tree-table requires:**
- Recursive rendering of table rows with dynamic indentation
- Expand/collapse state management
- Lazy data fetching on expand
- Inline form creation within table rows
- Visual depth indicators
- Interaction between expand state and status/assignee updates

**Meanwhile:** A flat table showing all tasks (with a parent task name column or visual indent) can be built in 2 hours and fully satisfies the spec's literal requirements.

**The real showcase for recursive React:** The Task **Creation** page (Part 4.3) — that's where the recursive `<TaskFormNode />` lives. The evaluators will see recursive React competency there. The List page doesn't need to repeat it.

**Fix:** Build the flat table first (Part 3 MVP in ~2 hours). If time permits, upgrade to tree-table. The Create page's recursive form already demonstrates the skill. Don't over-invest in the List page.

**Lesson:** In a time-boxed test, a clean simple solution that works beats an ambitious complex solution that's buggy. Ship the MVP, then polish.

---

## Summary: Recalibrated Priority Order

Based on these blind spots, the implementation priority should be:

1. **Ship working code** — Parts 1-3 as fast as possible (DB + API + simple flat-table UI)
2. **Add subtask support** — Part 4 (schema change + cascade guard + recursive Create form)
3. **Add LLM integration** — Part 5 (single provider, parallel enrichment)
4. **Containerize** — Part 6 (Docker, the simplest part)
5. **Document** — Part 7 (README with design decisions from wiki)
6. **Polish** — upgrade flat table to tree-table, add IN_PROGRESS status, multi-provider support

Items 1-5 are must-ship. Item 6 is if-time-permits.
