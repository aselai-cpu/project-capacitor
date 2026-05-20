import express from 'express';
import cors from 'cors';
import skillsRouter from './routes/skills.js';
import developersRouter from './routes/developers.js';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 5000;

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173').split(',');
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

app.get('/api/health', async (_, res) => {
  try {
    await (await import('./lib/prisma.js')).default.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

app.use('/api/skills', skillsRouter);
app.use('/api/developers', developersRouter);
app.use('/api/tasks', tasksRouter);

// Global error handler (must be after all routes)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

export default app;
