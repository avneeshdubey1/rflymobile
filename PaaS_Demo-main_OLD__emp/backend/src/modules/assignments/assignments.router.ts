import { Router } from 'express';
import { assignmentsController } from './assignments.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { assignPilotSchema } from './assignments.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

// Admin assigns pilot
router.post('/', roleGuard('Admin'), validate(assignPilotSchema), asyncHandler(async (req, res) => assignmentsController.assign(req, res)));

// Pilot actions — :id is the serviceRequestId
router.post('/:id/accept', roleGuard('Pilot'), asyncHandler(async (req, res) => assignmentsController.accept(req, res)));
router.post('/:id/start', roleGuard('Pilot'), asyncHandler(async (req, res) => assignmentsController.startSpraying(req, res)));
router.post('/:id/complete', roleGuard('Pilot'), asyncHandler(async (req, res) => assignmentsController.completeSpraying(req, res)));

export const assignmentsRouter = router;
