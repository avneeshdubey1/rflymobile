import { z } from 'zod';

export const trackerUpdateSchema = z.object({
  notes: z.string().min(1, 'Tracker notes are required'),
});

export type TrackerUpdateInput = z.infer<typeof trackerUpdateSchema>;
