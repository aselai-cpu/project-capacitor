// backend/src/routes/developers.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (_, res) => {
  const developers = await prisma.developer.findMany({
    include: { skills: { select: { id: true, name: true } } },
  });
  res.json(developers);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({
    where: { id: req.params['id'] as string },
    include: { skills: { select: { id: true, name: true } } },
  });
  if (!developer) {
    res.status(404).json({ error: 'Developer not found' });
    return;
  }
  res.json(developer);
}));

export default router;
