// backend/src/types.ts
import { z } from 'zod';

export interface CreateTaskInput {
  title: string;
  skillIds: string[];
  parentId: string | null;
  subtasks: CreateTaskInput[];
  projectId?: string | null;
  acceptanceCriteria?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createTaskSchema: z.ZodType<CreateTaskInput> = z.object({
  title: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional().default([]),
  parentId: z.string().uuid().nullable().optional().default(null),
  subtasks: z.lazy(() => z.array(createTaskSchema)).optional().default([]),
  projectId: z.string().uuid().nullable().optional().default(null),
  acceptanceCriteria: z.string().optional(),
}) as unknown as z.ZodType<CreateTaskInput>;

export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  developerId: z.string().uuid().nullable().optional(),
});

// --- Project schemas ---

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  techStack?: string[];
  architecture?: string;
  domain?: string;
  requirements?: string;
  constraints?: string;
  stakeholders?: string;
}

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  architecture: z.string().optional(),
  domain: z.string().optional(),
  requirements: z.string().optional(),
  constraints: z.string().optional(),
  stakeholders: z.string().optional(),
});
