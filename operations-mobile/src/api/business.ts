import { fetchApi, getPlatformInfo } from './client';
import { z } from 'zod';
import { MobileProfileSchema, MobileSessionSchema } from './auth';

export const BusinessLoginSchema = z.object({
  success: z.literal(true),
  session: MobileSessionSchema,
  profile: MobileProfileSchema,
}).passthrough();

export const BusinessDashboardSchema = z.object({
  success: z.literal(true),
  summary: z.object({
    totalRequests: z.number().int().nonnegative(),
    activeRequests: z.number().int().nonnegative(),
    recentActivity: z.array(z.object({ id: z.string().uuid(), status: z.string(), date: z.string() })),
  }),
});

export const BusinessRequestSchema = z.object({
  id: z.string().uuid(),
  crop: z.string().nullable(),
  area: z.string(),
  status: z.string(),
  date: z.string(),
});

export const BusinessRequestsSchema = z.object({
  success: z.literal(true),
  requests: z.array(BusinessRequestSchema),
});

export const BusinessNotificationsSchema = z.object({
  success: z.literal(true),
  notifications: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    message: z.string(),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  })),
});

export const BusinessProfileSchema = z.object({
  success: z.literal(true),
  profile: z.object({ name: z.string(), email: z.string().email(), role: z.string() }),
});

export const businessApi = {
  login: async (email: string, password: string) => {
    const platformInfo = await getPlatformInfo();
    return fetchApi('/api/mobile/v1/operations/auth/business/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...platformInfo }),
    }, BusinessLoginSchema);
  },
    
  getDashboard: () => 
    fetchApi('/api/mobile/v1/operations/business/dashboard', {}, BusinessDashboardSchema),
    
  getLinkedRequests: () => 
    fetchApi('/api/mobile/v1/operations/business/requests', {}, BusinessRequestsSchema),
    
  getNotifications: () => 
    fetchApi('/api/mobile/v1/operations/business/notifications', {}, BusinessNotificationsSchema),
    
  getProfile: () => 
    fetchApi('/api/mobile/v1/operations/business/profile', {}, BusinessProfileSchema),
};
