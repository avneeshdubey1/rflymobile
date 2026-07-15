import { Router } from 'express';
import { approvalController } from './approval.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { bbApprovalSchema } from './approval.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.post('/:requestId', roleGuard('Admin', 'Representative'), validate(bbApprovalSchema), asyncHandler(async (req, res) => approvalController.submit(req, res)));

export const approvalRouter = router;
