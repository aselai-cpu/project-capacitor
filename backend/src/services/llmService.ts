// backend/src/services/llmService.ts
//
// Provider-agnostic LLM skill classification.
// Auto-detects which provider to use based on which API key is set.
// Supports: Google Gemini, OpenAI, Anthropic, Moonshot Kimi.
//
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

const skillSchema = z.object({
  skills: z.array(z.enum(['Frontend', 'Backend']))
});

const PROMPT = (title: string) =>
  `You are a task classifier. Given this software task description, identify which technical skills it requires. Only classify as "Frontend" (UI, CSS, components, pages) or "Backend" (APIs, databases, servers, security) or both.\n\nTask: "${title}"`;

/**
 * Auto-detect LLM provider from environment variables.
 * Uses dynamic import() for ESM compatibility.
 */
async function getModel(): Promise<LanguageModel> {
  const explicit = process.env.LLM_PROVIDER;

  if (explicit === 'openai' || (!explicit && process.env.OPENAI_API_KEY)) {
    const { openai } = await import('@ai-sdk/openai');
    return openai(process.env.LLM_MODEL || 'gpt-4o-mini');
  }

  if (explicit === 'anthropic' || (!explicit && process.env.ANTHROPIC_API_KEY)) {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(process.env.LLM_MODEL || 'claude-haiku-4-5-20251001');
  }

  if (explicit === 'moonshot' || (!explicit && process.env.MOONSHOT_API_KEY)) {
    const { moonshotai } = await import('@ai-sdk/moonshotai');
    return moonshotai(process.env.LLM_MODEL || 'kimi-k2.5');
  }

  // Default: Google Gemini
  const { google } = await import('@ai-sdk/google');
  return google(process.env.LLM_MODEL || 'gemini-2.5-flash');
}

export function getActiveProvider(): string {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit) return explicit;
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.MOONSHOT_API_KEY) return 'moonshot';
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'google';
  return 'none (no API key set — skill classification will fail-open)';
}

export async function classifySkills(title: string): Promise<string[]> {
  try {
    const model = await getModel();
    const { object } = await generateObject({
      model,
      schema: skillSchema,
      prompt: PROMPT(title),
      experimental_telemetry: {
        isEnabled: true,
        metadata: { taskTitle: title },
      },
    });
    return object.skills;
  } catch (err) {
    logger.warn({ title, err }, 'LLM classify failed');
    return [];
  }
}
