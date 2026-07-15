import { Router } from 'express';
import { pilotsController } from './pilots.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);
router.get('/', roleGuard('Admin'), asyncHandler(async (req, res) => pilotsController.list(req, res)));

export const pilotsRouter = router;
