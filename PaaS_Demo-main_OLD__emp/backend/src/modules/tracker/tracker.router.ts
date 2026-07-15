import { Router } from 'express';
import { trackerController } from './tracker.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { trackerUpdateSchema } from './tracker.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.post('/:requestId', roleGuard('Admin', 'Ops', 'Representative'), validate(trackerUpdateSchema), asyncHandler(async (req, res) => trackerController.update(req, res)));

export const trackerRouter = router;
