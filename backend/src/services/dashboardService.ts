import prisma from '../lib/prisma.js';

export interface DashboardData {
  activeProjects: number;
  unassignedTasks: number;
  teamMembers: number;
  inProgressTasks: number;
  projects: Array<{ id: string; name: string; unassignedCount: number }>;
  workload: Array<{ developerId: string; developerName: string; taskCount: number }>;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [unassignedTasks, inProgressTasks, teamMembers, allProjects, developers] = await Promise.all([
    prisma.task.count({ where: { developerId: null } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.developer.count(),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        tasks: { where: { developerId: null }, select: { id: true } },
      },
    }),
    prisma.developer.findMany({
      select: {
        id: true,
        name: true,
        tasks: { select: { id: true } },
      },
    }),
  ]);

  const projects = allProjects.map(p => ({
    id: p.id,
    name: p.name,
    unassignedCount: p.tasks.length,
  }));

  const activeProjects = await prisma.project.count({
    where: {
      tasks: { some: { status: { in: ['TODO', 'IN_PROGRESS'] } } },
    },
  });

  const workload = developers.map(d => ({
    developerId: d.id,
    developerName: d.name,
    taskCount: d.tasks.length,
  }));

  return { activeProjects, unassignedTasks, teamMembers, inProgressTasks, projects, workload };
}
