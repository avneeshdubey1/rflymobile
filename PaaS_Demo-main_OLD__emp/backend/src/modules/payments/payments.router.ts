import { Router } from 'express';
import { paymentsController } from './payments.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { bcPaymentSchema, bbChecklistSchema } from './payments.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.post('/bc', roleGuard('Pilot'), validate(bcPaymentSchema), asyncHandler(async (req, res) => paymentsController.recordBC(req, res)));
router.post('/bb-checklist', roleGuard('Pilot'), validate(bbChecklistSchema), asyncHandler(async (req, res) => paymentsController.bbChecklist(req, res)));

export const paymentsRouter = router;
