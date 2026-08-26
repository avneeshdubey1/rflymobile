import { fetchApi, getPlatformInfo } from './client';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.any(), // Add stricter profile typing later
});

export const BootstrapResponseSchema = z.object({
  user: z.any(),
  capabilities: z.array(z.string()),
});

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

  bootstrap: () => fetchApi('/api/mobile/v1/operations/bootstrap', {}, BootstrapResponseSchema),
  
  logout: () => fetchApi('/api/mobile/v1/auth/logout', { method: 'POST' }),
  logoutAll: () => fetchApi('/api/mobile/v1/auth/logout-all', { method: 'POST' }),
};
