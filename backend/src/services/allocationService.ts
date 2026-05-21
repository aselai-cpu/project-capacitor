// backend/src/services/allocationService.ts
import prisma from '../lib/prisma.js';

export interface TaskScore {
  developerId: string;
  developerName: string;
  matchPercent: number;
  missingSkills: string[];
  currentTaskCount: number;
  isTopPick: boolean;
}

export interface ScoredTask {
  taskId: string;
  taskTitle: string;
  taskSkills: string[];
  scores: TaskScore[];
}

export async function getUnassignedScores(projectId?: string): Promise<ScoredTask[]> {
  const where: Record<string, unknown> = { developerId: null };
  if (projectId) where.projectId = projectId;

  const [tasks, developers] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { skills: { select: { id: true, name: true } } },
    }),
    prisma.developer.findMany({
      include: {
        skills: { select: { id: true, name: true } },
        tasks: { select: { id: true } },
      },
    }),
  ]);

  return tasks.map(task => {
    const taskSkillIds = new Set(task.skills.map(s => s.id));
    const taskSkillNames = task.skills.map(s => s.name);

    const scores: TaskScore[] = developers.map(dev => {
      const devSkillIds = new Set(dev.skills.map(s => s.id));

      if (taskSkillIds.size === 0) {
        return {
          developerId: dev.id,
          developerName: dev.name,
          matchPercent: 100,
          missingSkills: [],
          currentTaskCount: dev.tasks.length,
          isTopPick: false,
        };
      }

      const overlapping = task.skills.filter(s => devSkillIds.has(s.id));
      const missing = task.skills.filter(s => !devSkillIds.has(s.id)).map(s => s.name);
      const matchPercent = Math.round((overlapping.length / taskSkillIds.size) * 100);

      return {
        developerId: dev.id,
        developerName: dev.name,
        matchPercent,
        missingSkills: missing,
        currentTaskCount: dev.tasks.length,
        isTopPick: false,
      };
    });

    // Determine top pick: highest matchPercent, ties broken by lowest task count
    scores.sort((a, b) => b.matchPercent - a.matchPercent || a.currentTaskCount - b.currentTaskCount);
    const topScore = scores[0];
    if (topScore !== undefined && topScore.matchPercent > 0) {
      topScore.isTopPick = true;
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskSkills: taskSkillNames,
      scores,
    };
  });
}
