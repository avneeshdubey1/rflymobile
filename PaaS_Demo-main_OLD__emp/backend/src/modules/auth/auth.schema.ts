import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number'),
  role: z.enum(['BC', 'BB']),
  businessName: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
