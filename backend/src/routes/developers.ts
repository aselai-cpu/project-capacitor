// backend/src/routes/developers.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (_, res) => {
  const developers = await prisma.developer.findMany({
    include: { skills: { select: { id: true, name: true } } },
  });
  res.json(developers);
});

router.get('/:id', async (req, res) => {
  const developer = await prisma.developer.findUnique({
    where: { id: req.params.id },
    include: { skills: { select: { id: true, name: true } } },
  });
  if (!developer) return res.status(404).json({ error: 'Developer not found' });
  res.json(developer);
});

export default router;
