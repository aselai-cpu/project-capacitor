// backend/src/routes/tasks.ts
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, updateTaskSchema } from '../types.js';
import * as taskService from '../services/taskService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../lib/logger.js';
import { classifySkills, generateSubtasks } from '../services/llmService.js';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId, status, developerId } = req.query as Record<string, string | undefined>;
  const filters: taskService.TaskFilters = {};
  if (projectId) filters.projectId = projectId;
  if (status) filters.status = status;
  if (developerId) filters.developerId = developerId;
  const tasks = await taskService.getAllTasksFlat(filters);
  res.json(tasks);
});

router.get('/:id', async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/', validate(createTaskSchema), async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    logger.error({ err }, 'Task creation failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validate(updateTaskSchema), asyncHandler(async (req, res) => {
  const result = await taskService.updateTask(req.params.id as string, req.body);
  if (!result.success) {
    res.status(result.status).json({ error: result.error, ...(result.details ? { details: result.details } : {}) });
    return;
  }
  res.json(result.data);
}));

// AI-recommended developer assignment
router.post('/:id/recommend-assignee', asyncHandler(async (req, res) => {
  const recommendation = await taskService.getRecommendedAssignee(req.params.id as string);
  if (!recommendation) {
    res.status(404).json({ error: 'No recommendation available' });
    return;
  }
  res.json(recommendation);
}));

// POST /api/tasks/:id/generate-subtasks — AI subtask generation
router.post('/:id/generate-subtasks', asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: { skills: true, project: true },
  });
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  const { hint } = req.body as { hint?: string };
  if (!hint || typeof hint !== 'string') {
    res.status(400).json({ error: 'hint is required' }); return;
  }

  try {
    const [existingSubtasks, skills] = await Promise.all([
      prisma.task.findMany({ where: { parentId: task.id }, select: { title: true } }),
      prisma.skill.findMany({ select: { name: true } }),
    ]);

    const result = await generateSubtasks({
      taskTitle: task.title,
      ...(task.description ? { taskDescription: task.description } : {}),
      ...(task.acceptanceCriteria ? { taskAcceptanceCriteria: task.acceptanceCriteria } : {}),
      taskSkills: task.skills.map(s => s.name),
      ...(task.project ? {
        projectName: task.project.name,
        projectTechStack: task.project.techStack,
        ...(task.project.architecture ? { projectArchitecture: task.project.architecture } : {}),
      } : {}),
      existingSubtaskTitles: existingSubtasks.map(t => t.title),
      availableSkillNames: skills.map(s => s.name),
      hint,
    });

    res.json(result);
  } catch (err) {
    logger.warn({ err, taskId: task.id }, 'LLM subtask generation failed');
    res.status(502).json({ error: 'AI subtask generation failed — try again later' });
  }
}));

// DELETE /api/tasks/:id — Delete single task (cascades to subtasks)
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await taskService.deleteTask(req.params.id as string);
  if (!deleted) { res.status(404).json({ error: 'Task not found' }); return; }
  res.json({ deleted: true });
}));

// Test cleanup endpoint — deletes all tasks (for E2E test isolation)
router.delete('/', async (_, res) => {
  await taskService.deleteAllTasks();
  res.json({ deleted: true });
});

// POST /api/tasks/classify-skills — AI skill classification preview
router.post('/classify-skills', asyncHandler(async (req, res) => {
  const { title, acceptanceCriteria } = req.body as { title?: string; acceptanceCriteria?: string };
  if (!title) { res.status(400).json({ error: 'title is required' }); return; }

  const skills = await prisma.skill.findMany();
  const availableSkillNames = skills.map(s => s.name);
  const skillMap = new Map(skills.map(s => [s.name, s.id]));

  const classified = await classifySkills(title, availableSkillNames, acceptanceCriteria);

  res.json({
    skillIds: classified.map(name => skillMap.get(name)).filter(Boolean),
    skillNames: classified,
  });
}));

export default router;
