// backend/src/routes/tasks.ts
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createTaskSchema, updateTaskSchema } from '../types.js';
import * as taskService from '../services/taskService.js';

const router = Router();

router.get('/', async (_, res) => {
  const tasks = await taskService.getAllTasksFlat();
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
    console.error('Task creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validate(updateTaskSchema), async (req, res) => {
  const result = await taskService.updateTask(req.params.id as string, req.body);
  if ('error' in result) {
    return res.status(result.status).json(result);
  }
  res.json(result.data);
});

// Test cleanup endpoint — deletes all tasks (for E2E test isolation)
router.delete('/', async (_, res) => {
  await taskService.deleteAllTasks();
  res.json({ deleted: true });
});

export default router;
