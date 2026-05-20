// backend/src/services/llmService.ts
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const skillSchema = z.object({
  skills: z.array(z.enum(['Frontend', 'Backend']))
});

export async function classifySkills(title: string): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: skillSchema,
      prompt: `You are a task classifier. Given this software task description, identify which technical skills it requires. Only classify as "Frontend" (UI, CSS, components, pages) or "Backend" (APIs, databases, servers, security) or both.\n\nTask: "${title}"`,
    });
    return object.skills;
  } catch (err) {
    console.warn('LLM classify error for title:', title, err);
    return [];
  }
}
