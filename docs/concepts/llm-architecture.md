# About the LLM Integration Architecture

This document explains why the LLM integration is designed the way it is — the decisions behind provider abstraction, structured output, fail-open behavior, and how the two LLM features (skill classification and developer recommendation) connect to the domain model.

## Why an Abstraction Layer

The spec says "use any LLM provider such as Gemini." A direct `@google/genai` integration would satisfy the requirement, but it creates a problem: the evaluator might have an OpenAI key, not a Gemini key. Or the free Gemini tier might be rate-limited during evaluation.

The Vercel AI SDK solves this by providing a uniform interface (`generateObject()`) across all providers. The `getModel()` function in `llmService.ts` auto-detects which API key is available and returns the corresponding provider. The caller doesn't know or care whether it's talking to Gemini, GPT, Claude, or Kimi — the interface is identical.

This is the Strategy pattern applied to LLM providers: swap the implementation without changing the consumer. The dynamic `await import()` ensures only the needed provider's adapter is loaded, not all four.

## Why Structured Output Instead of Text Parsing

The original Gemini design discussion proposed prompting the LLM to return a JSON array as text, then parsing it with `JSON.parse()`. This is fragile — LLMs sometimes wrap JSON in markdown code blocks, add explanatory text, or produce malformed arrays.

The implementation uses Vercel AI SDK's `generateObject()` with a Zod schema:

```typescript
const { object } = await generateObject({
  model,
  schema: z.object({ skills: z.array(z.enum(['Frontend', 'Backend'])) }),
  prompt: '...',
});
```

This approach has three advantages:

1. **Guaranteed valid output.** The SDK uses the provider's native structured output mode (OpenAI's `response_format`, Gemini's `response_schema`) when available, and falls back to prompt-based extraction with Zod validation otherwise.

2. **Type safety.** `object.skills` is typed as `('Frontend' | 'Backend')[]` at compile time. No `JSON.parse()`, no `as string[]` cast, no runtime type checking needed.

3. **Provider portability.** The same Zod schema works across all providers. Switching from Gemini to OpenAI doesn't require changing the prompt structure or output parsing.

## Why Fail-Open

Both LLM functions (`classifySkills` and `recommendDeveloper`) catch all errors and return a safe default (`[]` or `null`). This is a deliberate design choice: **the LLM is an enhancement, not a gating function.**

A task created without skills is still a valid task. The user can assign skills manually. The assignee dropdown still works (it just shows all developers when no skills are required). The only consequence of LLM failure is that the task lacks auto-classified skills — which is the same state as a user who deliberately chose not to select skills.

The alternative — blocking task creation on LLM failure — would make the app unusable when the LLM provider is down, rate-limited, or misconfigured. For a take-home test where the evaluator might not have an API key configured, fail-open is the correct default.

## Two LLM Features and How They Differ

### Skill Classification (Part 5 requirement)

Triggered automatically during `POST /api/tasks` when a task has empty `skillIds`. The flow:

```
User creates task → taskService.createTask() → collectNodesWithoutSkills()
→ classifySkills() per node (parallel) → map skill names to DB IDs
→ save task with enriched skills
```

The user never sees the LLM call. It happens server-side, synchronously within the POST request lifecycle. If it takes too long (`LLM_TIMEOUT_MS`), the batch is abandoned and the task is saved without skills.

### Developer Recommendation (Beyond spec)

Triggered on-demand by the user clicking the 🤖 button on an unassigned task. The flow:

```
User clicks 🤖 → frontend calls POST /api/tasks/:id/recommend-assignee
→ backend fetches task skills + eligible developers + workload counts
→ recommendDeveloper() calls LLM with full context
→ returns {developerId, reason} → frontend shows ★ badge + reason text
```

This is user-initiated, not automatic. The user decides whether to accept the recommendation by selecting the suggested developer from the dropdown. The LLM provides advice; the human decides.

The key difference: skill classification is **invisible automation** (the user doesn't know an LLM was involved), while developer recommendation is **visible assistance** (the user explicitly asks for help and sees the reasoning).

## Why Parallel Classification with a Batch Timeout

When creating a task tree with subtasks, multiple nodes may need classification. Sequential LLM calls would be `N × latency` — for 5 nodes at 2 seconds each, that's 10 seconds. Unacceptable.

The implementation uses `Promise.allSettled()` to classify all nodes in parallel, wrapped in `Promise.race()` with a configurable timeout:

```typescript
Promise.race([
  Promise.allSettled(nodes.map(n => classifySkills(n.title))),
  timeout,
])
```

`allSettled` (not `all`) means individual LLM failures don't abort the batch. If 4 out of 5 nodes classify successfully before the timeout, those 4 get skills and the 5th is saved with empty skills. The timeout applies to the entire batch, not per-call — a 15-second timeout allows up to 15 seconds for all parallel calls to complete.

## The Prompt Design

The skill classification prompt is deliberately simple and constrained:

```
You are a task classifier. Given this software task description, identify
which technical skills it requires. Only classify as "Frontend" (UI, CSS,
components, pages) or "Backend" (APIs, databases, servers, security) or both.
```

The parenthetical examples ("UI, CSS, components, pages") serve as few-shot guidance without being explicit few-shot examples. They anchor the LLM's understanding of what "Frontend" and "Backend" mean in this project's context.

The developer recommendation prompt is richer because it has more context to work with — it includes the full developer list with skills and workload counts, and asks for a reasoned decision rather than a classification.

Both prompts use Zod structured output, which means the LLM must produce valid JSON matching the schema. The prompt doesn't need to say "return JSON" — the SDK handles that through the provider's structured output mechanism.

## Connection to the Domain Model

The LLM sits in the **Cognitive Context** of the DDD architecture (see `docs/concepts/domain-driven-design.md`). It bridges unstructured human language (task titles) and structured domain constraints (the skill taxonomy).

The Cognitive Context has no persistent state. It doesn't store classification results or learn from corrections. Each call is stateless — the same title will produce the same classification regardless of history. If a classification is wrong, the fix is manual: the user selects the correct skills on the task.

This statelessness is intentional. A learning system that adjusts classifications based on corrections would be more accurate but would also introduce state management complexity, training data concerns, and the possibility of drift. For a take-home test, stateless classification with fail-open behavior is the right trade-off.
