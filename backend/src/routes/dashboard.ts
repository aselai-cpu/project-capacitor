import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getDashboardData } from '../services/dashboardService.js';

const router = Router();

router.get('/', asyncHandler(async (_, res) => {
  const data = await getDashboardData();
  res.json(data);
}));

export default router;
