import { Router } from 'express';
import multer from 'multer';
import { runKickstart } from '../services/agentService.js';
import type { KickstartInput } from '../services/agentService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/kickstart', upload.any(), async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Parse multipart fields
  const name = req.body.name as string;
  const description = req.body.description as string;
  const existingDeveloperIds: string[] = JSON.parse(req.body.existingDeveloperIds || '[]');
  const newMembers: { name: string; cvText?: string }[] = JSON.parse(req.body.newMembers || '[]');

  // Map uploaded CV files by index (cv_0, cv_1, ...)
  const cvFiles = new Map<number, Buffer>();
  const files = req.files as Express.Multer.File[] | undefined;
  if (files) {
    for (const file of files) {
      const match = file.fieldname.match(/^cv_(\d+)$/);
      if (match) {
        cvFiles.set(parseInt(match[1]!, 10), file.buffer);
      }
    }
  }

  const input: KickstartInput = { name, description, existingDeveloperIds, newMembers, cvFiles };
  await runKickstart(res, input);
});

export default router;
