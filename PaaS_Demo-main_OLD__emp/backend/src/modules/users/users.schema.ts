import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  role: z.enum(['Admin', 'Pilot', 'Ops', 'Finance', 'BC', 'BB', 'Representative']),
  address: z.string().optional(),
  region: z.string().optional(),
  billingCycleDays: z.number().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
