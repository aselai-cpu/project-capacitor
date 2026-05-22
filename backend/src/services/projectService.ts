import prisma from '../lib/prisma.js';
import type { CreateProjectInput, UpdateProjectInput } from '../types.js';

const projectInclude = {
  tasks: {
    select: { id: true, title: true, status: true },
  },
};

export async function getAllProjects() {
  return prisma.project.findMany({
    include: projectInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: projectInclude,
  });
}

export async function createProject(input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
    },
    include: projectInclude,
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;
  return prisma.project.update({
    where: { id },
    data,
    include: projectInclude,
  });
}

export interface ProjectTasksParams {
  page: number;
  limit: number;
  status?: string;
  developerId?: string;
  sortBy: string;
}

export async function getProjectTasks(projectId: string, params: ProjectTasksParams) {
  const where: Record<string, unknown> = { projectId };
  if (params.status) where.status = params.status;
  if (params.developerId) {
    where.developerId = params.developerId === 'unassigned' ? null : params.developerId;
  }

  const orderBy: Record<string, string> = {};
  if (params.sortBy === 'oldest') orderBy.createdAt = 'asc';
  else if (params.sortBy === 'status') orderBy.status = 'desc';
  else orderBy.createdAt = 'desc';

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        skills: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    total,
    page: params.page,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function deleteProject(id: string) {
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  await prisma.project.delete({ where: { id } });
  return true;
}
