import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { sendOtpSchema, verifyOtpSchema, signUpSchema } from './auth.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Public routes
router.post('/send-otp', validate(sendOtpSchema), asyncHandler(async (req, res) => authController.sendOtp(req, res)));
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(async (req, res) => authController.verifyOtp(req, res)));
router.post('/sign-up', validate(signUpSchema), asyncHandler(async (req, res) => authController.signUp(req, res)));

// Protected route
router.get('/me', authMiddleware, asyncHandler(async (req, res) => authController.getMe(req, res)));

export const authRouter = router;
