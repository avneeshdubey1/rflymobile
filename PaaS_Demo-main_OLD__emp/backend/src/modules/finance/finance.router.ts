import { Router } from 'express';
import { financeController } from './finance.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { generateInvoiceSchema } from './finance.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authMiddleware);

router.get('/invoices', roleGuard('Finance', 'Admin'), asyncHandler(async (req, res) => financeController.list(req, res)));
router.post('/invoices', roleGuard('Finance', 'Admin'), validate(generateInvoiceSchema), asyncHandler(async (req, res) => financeController.generate(req, res)));

export const financeRouter = router;
