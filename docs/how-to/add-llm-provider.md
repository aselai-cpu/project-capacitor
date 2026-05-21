# How to Add a New LLM Provider

Add support for a new LLM provider to the skill classification and developer recommendation features.

**Prerequisites:** The provider must have a Vercel AI SDK adapter package (`@ai-sdk/<provider>`). Check [ai-sdk.dev/providers](https://ai-sdk.dev/providers) for the full list.

## Steps

### 1. Install the provider adapter

```bash
cd backend
npm install @ai-sdk/<provider-name>
```

Example for Mistral:
```bash
npm install @ai-sdk/mistral
```

### 2. Add the provider to `getModel()` in `llmService.ts`

Open `backend/src/services/llmService.ts`. Find the `getModel()` function. Add a new `if` block **before** the default Google Gemini fallback:

```typescript
if (explicit === 'mistral' || (!explicit && process.env.MISTRAL_API_KEY)) {
  const { mistral } = await import('@ai-sdk/mistral');
  return mistral(process.env.LLM_MODEL || 'mistral-small-latest');
}

// Default: Google Gemini  ← keep this last
```

Use `await import()` — not `require()`. The project is ESM.

### 3. Add the provider to `getActiveProvider()`

In the same file, add the env var check to `getActiveProvider()`. Insert it in the same priority order as `getModel()`:

```typescript
if (process.env.MISTRAL_API_KEY) return 'mistral';
```

### 4. Pass the API key through `docker-compose.yml`

Add the environment variable to the backend service:

```yaml
backend:
  environment:
    MISTRAL_API_KEY: ${MISTRAL_API_KEY:-}
```

### 5. Document in `.env`

Add a commented example to the root `.env` file:

```
# MISTRAL_API_KEY=your-key-here
```

### 6. Pass the key through `playwright.config.ts`

Add to the webServer env block so E2E tests can use it:

```typescript
...(process.env.MISTRAL_API_KEY && { MISTRAL_API_KEY: process.env.MISTRAL_API_KEY }),
```

### 7. Verify

```bash
# Build
cd backend && npm run build

# Test
npm test

# Run with the new provider
echo "MISTRAL_API_KEY=your-key" > .env
echo "LLM_PROVIDER=mistral" >> .env
npm run dev

# Check health endpoint
curl http://localhost:5000/api/health
# Expected: {"status":"ok","db":"connected","llm":"mistral"}

# Test classification
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Build a responsive homepage"}'
# Expected: skills: ["Frontend"]
```

### 8. Update README.md

Add the new provider to the Quick Start section, the Tech Stack table, and the Environment Variables table.

## Checklist

- [ ] `npm install @ai-sdk/<provider>`
- [ ] `getModel()` — new `if` block with `await import()`
- [ ] `getActiveProvider()` — new env var check
- [ ] `docker-compose.yml` — pass through API key
- [ ] `.env` — commented example
- [ ] `playwright.config.ts` — pass through for E2E
- [ ] `npm run build` — compiles
- [ ] `npm test` — 64 tests pass
- [ ] Health endpoint reports new provider name
- [ ] Classification returns correct skills
- [ ] README updated
