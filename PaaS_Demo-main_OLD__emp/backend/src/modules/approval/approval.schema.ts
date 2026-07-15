import { z } from 'zod';

export const bbApprovalSchema = z.object({
  representativeName: z.string().min(1),
  representativePhone: z.string().regex(/^\d{10}$/),
  isApproved: z.boolean(),
  rejectionReason: z.string().optional(),
});

export type BBApprovalInput = z.infer<typeof bbApprovalSchema>;
