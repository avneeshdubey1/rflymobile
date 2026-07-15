import { Router } from 'express';
import { usersController } from './users.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/role.middleware.js';
import { createUserSchema, updateUserStatusSchema } from './users.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Only Admins can access user management routes
router.use(authMiddleware, roleGuard('Admin'));

router.get('/', asyncHandler(usersController.list));
router.post('/', validate(createUserSchema), asyncHandler(usersController.create));
router.patch('/:id/status', validate(updateUserStatusSchema), asyncHandler(usersController.updateStatus));
router.delete('/:id', asyncHandler(usersController.remove));

export { router as usersRouter };
