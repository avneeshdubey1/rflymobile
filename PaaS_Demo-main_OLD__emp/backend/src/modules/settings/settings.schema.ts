import { z } from 'zod';

export const createTimeSlotSchema = z.object({
  slot: z.string().min(1, 'Slot label is required'),
});

export const toggleTimeSlotSchema = z.object({
  isActive: z.boolean(),
});

export const updateConfigSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string(),
});

export type CreateTimeSlotInput = z.infer<typeof createTimeSlotSchema>;
export type ToggleTimeSlotInput = z.infer<typeof toggleTimeSlotSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
