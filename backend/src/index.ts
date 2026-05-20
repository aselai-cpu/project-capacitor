import express from 'express';
import cors from 'cors';
import skillsRouter from './routes/skills.js';
import developersRouter from './routes/developers.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/skills', skillsRouter);
app.use('/api/developers', developersRouter);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

export default app;
