import { z } from 'zod';

export const assignPilotSchema = z.object({
  serviceRequestId: z.string().min(1),
  pilotId: z.string().min(1),
  representativeId: z.string().optional(),
});

export type AssignPilotInput = z.infer<typeof assignPilotSchema>;
