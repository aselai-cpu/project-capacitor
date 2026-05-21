// backend/src/routes/developers.ts
import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { extractSkillsFromCV } from '../services/llmService.js';
import { logger } from '../lib/logger.js';
import { validate } from '../middleware/validate.js';
import { createDeveloperSchema, updateDeveloperSchema } from '../types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// POST /api/developers — Create a new developer
router.post('/', validate(createDeveloperSchema), asyncHandler(async (req, res) => {
  const { name, skillIds } = req.body as { name: string; skillIds: string[] };
  const developer = await prisma.developer.create({
    data: {
      name,
      ...(skillIds.length > 0 && { skills: { connect: skillIds.map(id => ({ id })) } }),
    },
    include: { skills: { select: { id: true, name: true } } },
  });
  logger.info({ developerId: developer.id }, 'Developer created');
  res.status(201).json(developer);
}));

// PATCH /api/developers/:id — Update developer name/bio/skills
router.patch('/:id', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.developer.findUnique({ where: { id: id as string } });
  if (!existing) { res.status(404).json({ error: 'Developer not found' }); return; }

  const { name, bio, skillIds } = req.body as { name?: string; bio?: string; skillIds?: string[] };
  const developer = await prisma.developer.update({
    where: { id: id as string },
    data: {
      ...(name !== undefined && { name }),
      ...(bio !== undefined && { bio }),
      ...(skillIds !== undefined && { skills: { set: skillIds.map(id => ({ id })) } }),
    },
    include: { skills: { select: { id: true, name: true } } },
  });
  logger.info({ developerId: id }, 'Developer updated');
  res.json(developer);
}));

// DELETE /api/developers/:id — Delete a developer
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.developer.findUnique({ where: { id: id as string } });
  if (!existing) { res.status(404).json({ error: 'Developer not found' }); return; }

  await prisma.developer.delete({ where: { id: id as string } });
  logger.info({ developerId: id }, 'Developer deleted');
  res.json({ deleted: true });
}));

// POST /api/developers/:id/upload-cv — Upload PDF CV and extract skills
router.post('/:id/upload-cv', upload.single('cv'), asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { id: req.params['id'] as string } });
  if (!developer) { res.status(404).json({ error: 'Developer not found' }); return; }

  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  // Extract text from PDF
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: req.file.buffer });
  const textResult = await parser.getText();
  const cvText = textResult.text;

  // LLM extract skills
  const extracted = await extractSkillsFromCV(cvText);

  // Create or connect skills
  for (const skill of extracted.skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: {},
      create: { name: skill.name },
    });
  }

  const skillNames = extracted.skills.map(s => s.name);
  const dbSkills = await prisma.skill.findMany({ where: { name: { in: skillNames } } });

  // Update developer with CV data and skills
  const updated = await prisma.developer.update({
    where: { id: req.params['id'] as string },
    data: {
      cvText,
      cvFileName: req.file.originalname,
      bio: extracted.bio || null,
      skills: { set: dbSkills.map(s => ({ id: s.id })) },
    },
    include: { skills: { select: { id: true, name: true } } },
  });

  logger.info({ developerId: req.params['id'], skillCount: dbSkills.length }, 'CV uploaded and skills extracted');
  res.json({ ...updated, extractedSkills: extracted.skills });
}));

// POST /api/developers/:id/extract-skills — Extract skills from pasted CV text
router.post('/:id/extract-skills', asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { id: req.params['id'] as string } });
  if (!developer) { res.status(404).json({ error: 'Developer not found' }); return; }

  const { cvText } = req.body as { cvText?: unknown };
  if (!cvText || typeof cvText !== 'string') {
    res.status(400).json({ error: 'cvText is required' }); return;
  }

  // LLM extract skills
  const extracted = await extractSkillsFromCV(cvText);

  // Create or connect skills
  for (const skill of extracted.skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: {},
      create: { name: skill.name },
    });
  }

  const skillNames = extracted.skills.map(s => s.name);
  const dbSkills = await prisma.skill.findMany({ where: { name: { in: skillNames } } });

  // Update developer
  const updated = await prisma.developer.update({
    where: { id: req.params['id'] as string },
    data: {
      cvText,
      bio: extracted.bio || null,
      skills: { set: dbSkills.map(s => ({ id: s.id })) },
    },
    include: { skills: { select: { id: true, name: true } } },
  });

  logger.info({ developerId: req.params['id'], skillCount: dbSkills.length }, 'Skills extracted from CV text');
  res.json({ ...updated, extractedSkills: extracted.skills });
}));

export default router;
