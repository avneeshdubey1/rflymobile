import { Router } from 'express';
import { notificationsController } from './notifications.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => notificationsController.list(req, res)));
router.patch('/:id/read', asyncHandler(async (req, res) => notificationsController.markRead(req, res)));
router.post('/read-all', asyncHandler(async (req, res) => notificationsController.markAllRead(req, res)));

export const notificationsRouter = router;
