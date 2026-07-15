import jwt from 'jsonwebtoken';
import { db, otpStore } from '../../config/db.js';
import { appConfig } from '../../config/app.config.js';
import { ApiError } from '../../utils/ApiError.js';
import type { SignUpInput } from './auth.schema.js';

export class AuthService {
  /**
   * Generates and "sends" an OTP (demo: always 123456).
   */
  async sendOtp(phone: string): Promise<void> {
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) throw ApiError.notFound('User not found');
    if (!user.isActive) throw ApiError.forbidden('Account is disabled');

    // Demo: Fixed OTP 123456, valid for 5 mins
    otpStore.set(phone, {
      code: '123456',
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  /**
   * Verifies OTP and issues a JWT.
   */
  async verifyOtp(phone: string, otp: string) {
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) throw ApiError.notFound('User not found');
    if (!user.isActive) throw ApiError.forbidden('Account is disabled');

    const storedOtp = otpStore.get(phone);
    if (!storedOtp) throw ApiError.badRequest('OTP not requested or expired');
    if (storedOtp.code !== otp) throw ApiError.badRequest('Invalid OTP');
    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(phone);
      throw ApiError.badRequest('OTP expired');
    }

    otpStore.delete(phone);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      appConfig.jwt.secret,
      { expiresIn: appConfig.jwt.expiresIn }
    );

    return { token, user };
  }

  /**
   * Self-registration for BC/BB customers.
   */
  async signUp(input: SignUpInput) {
    const existing = await db.user.findUnique({ where: { phone: input.phone } });
    if (existing) throw ApiError.conflict('An account with this phone number already exists');

    const customer = await db.customer.create({
      data: {
        name: input.businessName || input.name,
        phone: input.phone,
        type: input.role as 'BC' | 'BB',
        address: input.address,
        region: input.region,
        billingCycleDays: input.role === 'BB' ? 15 : 0,
      },
    });

    await db.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        role: input.role as any,
        isActive: true,
        customerId: customer.id,
      },
    });

    return { message: 'Account created successfully. You can now log in.' };
  }

  /**
   * Returns current user context.
   */
  async getMe(userId: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }
}

export const authService = new AuthService();
