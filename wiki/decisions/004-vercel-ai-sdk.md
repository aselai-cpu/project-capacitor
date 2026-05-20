---
type: decision
title: 004 — Use Vercel AI SDK for LLM abstraction
created: 2026-05-21
status: accepted
---
# ADR-004: Use Vercel AI SDK for LLM Abstraction

## Context

[[wiki/requirements/part5-llm-skill-id|Part 5]] requires backend integration with an LLM API to auto-classify task titles into required skills (Frontend, Backend, or both). The spec suggests Gemini but allows any provider. Hardcoding to `@google/genai` (as proposed in [[wiki/notes/gemini-design-discussion]]) creates a direct vendor dependency.

Key concerns:
- Evaluators may have API keys for different providers (OpenAI, Anthropic, Gemini)
- Vendor lock-in limits flexibility and testability
- [[wiki/notes/research-papers|Paper 07 (JSONSchemaBench)]] shows structured output support varies across providers — an abstraction layer lets us leverage the best option available
- Backend is TypeScript/Node.js, so the abstraction must be TypeScript-native

## Decision

Use the **Vercel AI SDK** (`ai` npm package) as the LLM abstraction layer, with provider-specific adapters installed separately.

### Package structure
- `ai` — core SDK with `generateText()`, `generateObject()`, `streamText()`
- `@ai-sdk/google` — Gemini provider adapter (default)
- `@ai-sdk/openai` — OpenAI provider adapter (fallback)
- `@ai-sdk/anthropic` — Anthropic provider adapter (optional)

### Structured output via Zod
Instead of prompting for raw JSON text and parsing it (fragile), use `generateObject()` with a Zod schema:

```typescript
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: z.object({
    skills: z.array(z.enum(['Frontend', 'Backend']))
  }),
  prompt: `Classify this task: "${taskTitle}"`
});
// object.skills is typed as ('Frontend' | 'Backend')[]
```

This approach:
- Guarantees valid JSON matching the schema (uses provider's native structured output when available)
- Returns TypeScript-typed output (no manual parsing)
- Falls back to prompt-based JSON extraction + validation for providers without native structured output

### Provider switching
Controlled via environment variable:

```typescript
function getModel() {
  switch (process.env.LLM_PROVIDER) {
    case 'openai': return openai('gpt-4o-mini');
    case 'anthropic': return anthropic('claude-haiku-4-5-20251001');
    default: return google('gemini-2.5-flash');
  }
}
```

## Consequences

- **Positive:** Provider-agnostic — evaluators can use whichever API key they have
- **Positive:** `generateObject()` with Zod eliminates JSON parsing bugs (validates Paper 07's recommendation to use native structured output)
- **Positive:** TypeScript-native with full type safety — no `any` types for LLM responses
- **Positive:** Well-recognized in the ecosystem — strengthens README library justification
- **Trade-off:** Additional dependency (`ai` + provider adapter) vs single `@google/genai` package
- **Trade-off:** Slight abstraction overhead, but negligible for our single-call-per-task-creation use case
- **Supersedes:** The `@google/genai` approach from [[wiki/notes/gemini-design-discussion]] — same Gemini model, but accessed through the AI SDK adapter instead of directly
