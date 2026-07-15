import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { SendOtpInput, VerifyOtpInput, SignUpInput } from './auth.schema.js';

export class AuthController {
  async sendOtp(req: Request, res: Response): Promise<void> {
    const { phone } = req.body as SendOtpInput;
    console.log(`[AUTH] sendOtp called for phone: "${phone}"`);
    await authService.sendOtp(phone);
    console.log(`[AUTH] sendOtp succeeded for phone: "${phone}"`);
    ApiResponse.success(res, { message: 'OTP sent successfully' });
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    const { phone, otp } = req.body as VerifyOtpInput;
    console.log(`[AUTH] verifyOtp called for phone: "${phone}", otp: "${otp}"`);
    const data = await authService.verifyOtp(phone, otp);
    console.log(`[AUTH] verifyOtp succeeded for phone: "${phone}"`);
    ApiResponse.success(res, data);
  }

  async signUp(req: Request, res: Response): Promise<void> {
    const data = await authService.signUp(req.body as SignUpInput);
    ApiResponse.created(res, data);
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const data = await authService.getMe(req.user!.userId);
    ApiResponse.success(res, data);
  }
}

export const authController = new AuthController();
