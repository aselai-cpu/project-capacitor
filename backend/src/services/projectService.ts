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

export async function deleteProject(id: string) {
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  await prisma.project.delete({ where: { id } });
  return true;
}
