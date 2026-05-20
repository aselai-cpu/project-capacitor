// backend/src/services/llmService.ts
//
// Provider-agnostic LLM skill classification.
// Auto-detects which provider to use based on which API key is set.
// Supports: Google Gemini, OpenAI, Anthropic.
//
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

const skillSchema = z.object({
  skills: z.array(z.enum(['Frontend', 'Backend']))
});

const PROMPT = (title: string) =>
  `You are a task classifier. Given this software task description, identify which technical skills it requires. Only classify as "Frontend" (UI, CSS, components, pages) or "Backend" (APIs, databases, servers, security) or both.\n\nTask: "${title}"`;

/**
 * Auto-detect LLM provider from environment variables.
 * Priority: explicit LLM_PROVIDER env var > auto-detect from API key presence.
 */
function getModel(): LanguageModel {
  const explicit = process.env.LLM_PROVIDER;

  if (explicit === 'openai' || (!explicit && process.env.OPENAI_API_KEY)) {
    // Dynamic import is not needed — Vercel AI SDK reads env vars automatically
    const { openai } = require('@ai-sdk/openai');
    return openai(process.env.LLM_MODEL || 'gpt-4o-mini');
  }

  if (explicit === 'anthropic' || (!explicit && process.env.ANTHROPIC_API_KEY)) {
    const { anthropic } = require('@ai-sdk/anthropic');
    return anthropic(process.env.LLM_MODEL || 'claude-haiku-4-5-20251001');
  }

  // Default: Google Gemini
  const { google } = require('@ai-sdk/google');
  return google(process.env.LLM_MODEL || 'gemini-2.5-flash');
}

export function getActiveProvider(): string {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit) return explicit;
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'google';
  return 'none (no API key set — skill classification will fail-open)';
}

export async function classifySkills(title: string): Promise<string[]> {
  try {
    const model = getModel();
    const { object } = await generateObject({
      model,
      schema: skillSchema,
      prompt: PROMPT(title),
    });
    return object.skills;
  } catch (err) {
    console.warn('LLM classify error for title:', title, err);
    return [];
  }
}
