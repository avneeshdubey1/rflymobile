import { Router } from 'express';
import { requestsController } from './requests.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createRequestSchema } from './requests.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);

router.get('/', roleGuard('Admin', 'Ops', 'Finance'), asyncHandler(async (req, res) => requestsController.list(req, res)));
router.get('/:id', asyncHandler(async (req, res) => requestsController.getById(req, res)));
router.post('/', roleGuard('Admin', 'BC', 'BB'), validate(createRequestSchema), asyncHandler(async (req, res) => requestsController.create(req, res)));

export const requestsRouter = router;
