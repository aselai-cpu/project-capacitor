import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getUnassignedScores } from '../services/allocationService.js';
import { generateAllocationReason } from '../services/llmService.js';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/allocate/scores — Match scores for unassigned tasks
router.get('/scores', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const scores = await getUnassignedScores(projectId);
  res.json(scores);
}));

// POST /api/allocate/reason — On-demand LLM reasoning for a task-developer pair
router.post('/reason', asyncHandler(async (req, res) => {
  const { taskId, developerId } = req.body as { taskId?: string; developerId?: string };
  if (!taskId || !developerId) {
    res.status(400).json({ error: 'taskId and developerId are required' });
    return;
  }

  const [task, developer] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, include: { skills: true } }),
    prisma.developer.findUnique({ where: { id: developerId }, include: { skills: true, tasks: { select: { id: true } } } }),
  ]);

  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  if (!developer) { res.status(404).json({ error: 'Developer not found' }); return; }

  const reason = await generateAllocationReason(
    task.title,
    task.skills.map(s => s.name),
    developer.name,
    developer.skills.map(s => s.name),
    developer.tasks.length,
  );

  res.json({ reason });
}));

export default router;
