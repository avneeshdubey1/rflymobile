import { fetchApi, getPlatformInfo } from './client';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const MobileProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable().optional(),
  employeeCode: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  homeCenterId: z.string().uuid().nullable().optional(),
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'SALES', 'FARMER', 'BUSINESS', 'PILOT']),
  pilotAvailabilityState: z.string().nullable().optional(),
});
export type MobileProfile = z.infer<typeof MobileProfileSchema>;

export const MobileSessionSchema = z.object({
  accessToken: z.string().min(20),
  tokenType: z.literal('Bearer').optional(),
  idleExpiresAt: z.string().optional(),
  absoluteExpiresAt: z.string().optional(),
});

export const LoginResponseSchema = z.object({
  success: z.literal(true).optional(),
  session: MobileSessionSchema,
  profile: MobileProfileSchema,
}).passthrough();

export const BootstrapResponseSchema = z.object({
  success: z.literal(true).optional(),
  profile: MobileProfileSchema,
  capabilities: z.array(z.string()).default([]),
}).passthrough();

export const authApi = {
  login: async (data: z.infer<typeof LoginSchema>) => {
    const platformInfo = await getPlatformInfo();
    return fetchApi('/api/mobile/v1/operations/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        ...platformInfo,
      }),
    }, LoginResponseSchema);
  },

  bootstrap: (accessToken?: string) => fetchApi(
    '/api/mobile/v1/operations/bootstrap',
    accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    BootstrapResponseSchema,
  ),
  
  logout: () => fetchApi('/api/mobile/v1/auth/logout', { method: 'POST' }),
  logoutAll: () => fetchApi('/api/mobile/v1/auth/logout-all', { method: 'POST' }),
};
