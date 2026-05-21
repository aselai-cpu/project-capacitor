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

// --- AI-assisted developer recommendation ---

const recommendSchema = z.object({
  developerId: z.string(),
  reason: z.string(),
});

export interface DeveloperInfo {
  id: string;
  name: string;
  skills: string[];
  currentTaskCount: number;
}

export async function recommendDeveloper(
  taskTitle: string,
  taskSkills: string[],
  eligibleDevelopers: DeveloperInfo[],
): Promise<{ developerId: string; developerName: string; reason: string } | null> {
  if (eligibleDevelopers.length === 0) return null;
  if (eligibleDevelopers.length === 1) {
    return {
      developerId: eligibleDevelopers[0]!.id,
      developerName: eligibleDevelopers[0]!.name,
      reason: `Only eligible developer with ${taskSkills.join(' + ')} skills`,
    };
  }

  try {
    const model = await getModel();
    const devList = eligibleDevelopers.map(d =>
      `- ${d.name} (id: ${d.id}) — skills: ${d.skills.join(', ')} — current workload: ${d.currentTaskCount} tasks`
    ).join('\n');

    const { object } = await generateObject({
      model,
      schema: recommendSchema,
      prompt: `You are a project manager AI assistant. Given a task and a list of eligible developers, recommend the best developer to assign.

Task: "${taskTitle}"
Required skills: ${taskSkills.join(', ')}

Eligible developers:
${devList}

Consider: skill match quality, workload balance (prefer less busy developers), and task-skill alignment.
Return the developer's id and a brief reason (1 sentence).`,
      experimental_telemetry: {
        isEnabled: true,
        metadata: { feature: 'recommend-assignee', taskTitle },
      },
    });

    const dev = eligibleDevelopers.find(d => d.id === object.developerId);
    return {
      developerId: object.developerId,
      developerName: dev?.name ?? 'Unknown',
      reason: object.reason,
    };
  } catch (err) {
    logger.warn({ taskTitle, err }, 'LLM recommend-assignee failed');
    return null;
  }
}

// --- Skill classification ---

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
