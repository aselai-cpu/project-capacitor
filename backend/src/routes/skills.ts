// backend/src/routes/skills.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (_, res) => {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
  });
  res.json(skills);
});

export default router;
