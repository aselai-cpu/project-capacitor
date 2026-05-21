# LLM Service Reference

Technical reference for the LLM integration layer in `backend/src/services/llmService.ts`.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    llmService.ts                      │
│                                                      │
│  getModel()  ──→  Provider auto-detection            │
│       │           (reads env vars, returns           │
│       │            LanguageModel instance)            │
│       ▼                                              │
│  classifySkills(title)  ──→  Skill classification    │
│       │                      (returns string[])      │
│       ▼                                              │
│  recommendDeveloper(...)  ──→  Assignment suggestion  │
│                               (returns {id, reason}) │
│                                                      │
│  getActiveProvider()  ──→  Status reporting           │
│                           (returns provider name)    │
└──────────────────────────────────────────────────────┘
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `ai` | Vercel AI SDK core — `generateObject()` |
| `@ai-sdk/google` | Google Gemini adapter |
| `@ai-sdk/openai` | OpenAI adapter |
| `@ai-sdk/anthropic` | Anthropic Claude adapter |
| `@ai-sdk/moonshotai` | Moonshot Kimi adapter |
| `zod` | Structured output schemas |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | One of | — | Google Gemini API key |
| `OPENAI_API_KEY` | these | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | must be | — | Anthropic Claude API key |
| `MOONSHOT_API_KEY` | set | — | Moonshot Kimi API key |
| `LLM_PROVIDER` | No | Auto-detected | Force provider: `google`, `openai`, `anthropic`, `moonshot` |
| `LLM_MODEL` | No | Per-provider default | Override model name |
| `LLM_TIMEOUT_MS` | No | `5000` | Batch timeout for parallel classification (ms). Set in `taskService.ts`. |

## Provider Auto-Detection

Detection order when `LLM_PROVIDER` is not set:

1. `OPENAI_API_KEY` present → OpenAI
2. `ANTHROPIC_API_KEY` present → Anthropic
3. `MOONSHOT_API_KEY` present → Moonshot
4. `GOOGLE_GENERATIVE_AI_API_KEY` present → Google (fallback)
5. No key set → `getModel()` defaults to Google (will fail at API call time)

When `LLM_PROVIDER` is explicitly set, it overrides auto-detection regardless of which keys are present.

## Default Models

| Provider | `LLM_PROVIDER` value | Default model | Package |
|----------|---------------------|---------------|---------|
| Google Gemini | `google` | `gemini-2.5-flash` | `@ai-sdk/google` |
| OpenAI | `openai` | `gpt-4o-mini` | `@ai-sdk/openai` |
| Anthropic | `anthropic` | `claude-haiku-4-5-20251001` | `@ai-sdk/anthropic` |
| Moonshot | `moonshot` | `kimi-k2.5` | `@ai-sdk/moonshotai` |

## Functions

### `getModel(): Promise<LanguageModel>`

Private. Returns a Vercel AI SDK `LanguageModel` instance for the detected provider. Uses dynamic `await import()` for ESM compatibility. Called by `classifySkills` and `recommendDeveloper`.

### `getActiveProvider(): string`

Returns the name of the currently active provider as a string. Used by the `/api/health` endpoint to report LLM status. Does not instantiate the model — only reads environment variables.

**Returns:** `'openai'` | `'anthropic'` | `'moonshot'` | `'google'` | `'none (no API key set — skill classification will fail-open)'`

### `classifySkills(title: string): Promise<string[]>`

Classifies a task title into required skills.

**Parameters:**
- `title` — The task title text (e.g., `"As a visitor, I want a responsive homepage..."`)

**Returns:** Array of skill names. Possible values: `['Frontend']`, `['Backend']`, `['Frontend', 'Backend']`, or `[]` on failure.

**Error handling:** Fail-open. On any error (network, timeout, invalid response), returns `[]` and logs a warning. Never throws.

**Structured output schema:**
```typescript
z.object({
  skills: z.array(z.enum(['Frontend', 'Backend']))
})
```

**Prompt template:**
```
You are a task classifier. Given this software task description, identify
which technical skills it requires. Only classify as "Frontend" (UI, CSS,
components, pages) or "Backend" (APIs, databases, servers, security) or both.

Task: "${title}"
```

### `recommendDeveloper(taskTitle, taskSkills, eligibleDevelopers): Promise<{...} | null>`

Recommends the best developer to assign to a task.

**Parameters:**
- `taskTitle` — The task title text
- `taskSkills` — Array of required skill names (e.g., `['Frontend', 'Backend']`)
- `eligibleDevelopers` — Array of `DeveloperInfo` objects (developers whose skills are a superset of the task's required skills)

**`DeveloperInfo` interface:**
```typescript
{
  id: string;
  name: string;
  skills: string[];
  currentTaskCount: number;
}
```

**Returns:** `{ developerId, developerName, reason }` or `null` on failure.

**Short-circuit logic:**
- 0 eligible developers → returns `null`
- 1 eligible developer → returns that developer without calling the LLM
- 2+ eligible developers → calls the LLM for recommendation

**Error handling:** Fail-open. Returns `null` on any error. Never throws.

**Structured output schema:**
```typescript
z.object({
  developerId: z.string(),
  reason: z.string(),
})
```

## Parallel Classification in taskService.ts

When creating a task tree, multiple nodes may need skill classification. The `createTask` function in `taskService.ts` handles this:

```
1. collectNodesWithoutSkills(tree)  →  Find all nodes with empty skillIds
2. Promise.allSettled(nodes.map(classifySkills))  →  Classify in parallel
3. Promise.race([classifications, timeout])  →  Batch timeout (LLM_TIMEOUT_MS)
4. Apply results to nodes  →  Map skill names to database IDs
5. Save tree  →  Prisma atomic transaction
```

If the batch timeout fires before all classifications complete, the tree is saved with empty skills for unclassified nodes. This is the fail-open behavior.

## API Endpoints

### `POST /api/tasks/:id/recommend-assignee`

Calls `recommendDeveloper` for the specified task.

**Response (200):**
```json
{
  "developerId": "uuid",
  "developerName": "Alice",
  "reason": "Alice has frontend expertise and lowest workload"
}
```

**Response (404):** No eligible developers or task not found.

### `GET /api/health`

Includes `llm` field showing the active provider.

```json
{
  "status": "ok",
  "db": "connected",
  "llm": "openai"
}
```

## Telemetry

Both `classifySkills` and `recommendDeveloper` include `experimental_telemetry` in their `generateObject` calls:

```typescript
experimental_telemetry: {
  isEnabled: true,
  metadata: { taskTitle: title },
}
```

This emits OpenTelemetry spans for each LLM call. If Langfuse is configured (`LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`), these spans are exported to Langfuse for GenAI-specific observability (latency, token usage, cost, prompt/response).
