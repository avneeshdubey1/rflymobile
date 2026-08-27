import { fetchApi, getPlatformInfo } from './client';
import { z } from 'zod';
import { MobileProfileSchema, MobileSessionSchema } from './auth';

export const RequestOtpResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  challengeId: z.string().uuid(),
  resendAvailableAt: z.string(),
});

export const ResendOtpResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export const VerifyOtpResponseSchema = z.object({
  success: z.literal(true),
  session: MobileSessionSchema,
  profile: MobileProfileSchema,
}).passthrough();

export const FarmerDashboardResponseSchema = z.object({
  success: z.literal(true),
  history: z.array(z.object({
    id: z.string().uuid(),
    status: z.string(),
    area: z.string(),
    crop: z.string().nullable(),
    date: z.string(),
  })),
});

export const SubmitRequestResponseSchema = z.object({
  success: z.literal(true),
  outcome: z.literal('ACCEPTED'),
  lead: z.object({
    id: z.string().uuid(),
    status: z.string(),
    acreage: z.string(),
    crop: z.string().nullable(),
    operatingCenterId: z.string().uuid().nullable(),
    createdAt: z.string(),
  }),
  assignmentOutcome: z.string().nullable(),
});

export const farmerApi = {
  requestOtp: (phone: string) => 
    fetchApi('/api/mobile/v1/operations/auth/farmer/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }, RequestOtpResponseSchema),

  resendOtp: (challengeId: string) =>
    fetchApi('/api/mobile/v1/operations/auth/farmer/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
    }, ResendOtpResponseSchema),
    
  verifyOtp: async (challengeId: string, code: string) => {
    const platformInfo = await getPlatformInfo();
    return fetchApi('/api/mobile/v1/operations/auth/farmer/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code, ...platformInfo }),
    }, VerifyOtpResponseSchema);
  },
    
  getDashboard: () => 
    fetchApi('/api/mobile/v1/operations/farmer/dashboard', {}, FarmerDashboardResponseSchema, { dataset: 'customerSummary', key: 'farmer_dashboard' }),
    
  submitRequest: (requestData: Record<string, unknown>) =>
    fetchApi('/api/mobile/v1/operations/farmer/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }, SubmitRequestResponseSchema),
};
