import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.get('/', roleGuard('Admin', 'Finance'), asyncHandler(async (req, res) => analyticsController.getSnapshot(req, res)));

export const analyticsRouter = router;
