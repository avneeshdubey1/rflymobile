import { Router } from 'express';
import { appDataController } from './app-data.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => appDataController.getAppData(req, res)));

export const appDataRouter = router;
