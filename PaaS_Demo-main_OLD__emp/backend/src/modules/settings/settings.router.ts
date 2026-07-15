import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

// Get paths are allowed for all authenticated users
router.get('/slots', asyncHandler((req, res) => settingsController.getTimeSlots(req, res)));
router.get('/configs', asyncHandler((req, res) => settingsController.getConfigs(req, res)));

// Modify paths are guarded for Admin role only
router.post('/slots', roleGuard('Admin'), asyncHandler((req, res) => settingsController.createTimeSlot(req, res)));
router.put('/slots/:id/toggle', roleGuard('Admin'), asyncHandler((req, res) => settingsController.toggleTimeSlot(req, res)));
router.delete('/slots/:id', roleGuard('Admin'), asyncHandler((req, res) => settingsController.deleteTimeSlot(req, res)));
router.post('/configs', roleGuard('Admin'), asyncHandler((req, res) => settingsController.updateConfig(req, res)));

export const settingsRouter = router;
