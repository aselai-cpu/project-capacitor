import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from '../types.js';
import * as projectService from '../services/projectService.js';
import { enrichProject, generateUserStories, generateTasks } from '../services/llmService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../lib/logger.js';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', asyncHandler(async (_, res) => {
  const projects = await projectService.getAllProjects();
  res.json(projects);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(project);
}));

// GET /api/projects/:id/tasks — Paginated project tasks
router.get('/:id/tasks', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const status = req.query.status as string | undefined;
  const developerId = req.query.developerId as string | undefined;
  const sortBy = (req.query.sortBy as string) || 'newest';

  const result = await projectService.getProjectTasks(req.params.id as string, {
    page,
    limit,
    sortBy,
    ...(status !== undefined && { status }),
    ...(developerId !== undefined && { developerId }),
  });
  res.json(result);
}));

router.post('/', validate(createProjectSchema), asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.body);
  res.status(201).json(project);
}));

router.patch('/:id', validate(updateProjectSchema), asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.params.id as string, req.body);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(project);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await projectService.deleteProject(req.params.id as string);
  if (!deleted) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json({ deleted: true });
}));

// LLM: Enrich project specification
router.post('/:id/enrich', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  try {
    const enrichContext: import('../services/llmService.js').ProjectContext = { name: project.name };
    if (project.description) enrichContext.description = project.description;
    const enriched = await enrichProject(enrichContext);
    const updated = await projectService.updateProject(project.id, enriched);
    res.json(updated);
  } catch (err) {
    logger.warn({ err, projectId: project.id }, 'LLM project enrichment failed');
    res.status(502).json({ error: 'AI enrichment failed — try again later' });
  }
}));

// LLM: Generate 10 user stories
router.post('/:id/generate-stories', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  try {
    const storyContext: import('../services/llmService.js').FullProjectContext = {
      name: project.name,
      techStack: project.techStack,
    };
    if (project.description) storyContext.description = project.description;
    if (project.architecture) storyContext.architecture = project.architecture;
    if (project.domain) storyContext.domain = project.domain;
    if (project.requirements) storyContext.requirements = project.requirements;
    const stories = await generateUserStories(storyContext);
    res.json({ stories });
  } catch (err) {
    logger.warn({ err, projectId: project.id }, 'LLM story generation failed');
    res.status(502).json({ error: 'AI story generation failed — try again later' });
  }
}));

// LLM: Generate tasks with direction hint
router.post('/:id/generate-tasks', asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.params.id as string);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const { hint } = req.body as { hint?: string };
  if (!hint || typeof hint !== 'string') {
    res.status(400).json({ error: 'hint is required' }); return;
  }

  try {
    const [existingTasks, skills] = await Promise.all([
      prisma.task.findMany({ where: { projectId: project.id }, select: { title: true } }),
      prisma.skill.findMany({ select: { name: true } }),
    ]);

    const taskCtx: import('../services/llmService.js').GenerateTasksContext = {
      name: project.name,
      techStack: project.techStack,
      existingTaskTitles: existingTasks.map(t => t.title),
      availableSkillNames: skills.map(s => s.name),
      hint,
    };
    if (project.description) taskCtx.description = project.description;
    if (project.architecture) taskCtx.architecture = project.architecture;
    if (project.domain) taskCtx.domain = project.domain;
    if (project.requirements) taskCtx.requirements = project.requirements;
    if (project.constraints) taskCtx.constraints = project.constraints;

    const result = await generateTasks(taskCtx);

    res.json(result);
  } catch (err) {
    logger.warn({ err, projectId: project.id }, 'LLM task generation failed');
    res.status(502).json({ error: 'AI task generation failed — try again later' });
  }
}));

export default router;
