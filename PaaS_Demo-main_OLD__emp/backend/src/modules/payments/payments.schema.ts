import { z } from 'zod';

export const bcPaymentSchema = z.object({
  serviceRequestId: z.string().min(1),
  upiTransactionRef: z.string().min(1, 'UPI reference is required'),
  amountPaid: z.number().positive('Amount must be positive'),
});

export const bbChecklistSchema = z.object({
  serviceRequestId: z.string().min(1),
  billCollected: z.boolean(),
  billPhotoUrl: z.string().optional(),
  screenshotUrl: z.string().optional(),
});

export type BCPaymentInput = z.infer<typeof bcPaymentSchema>;
export type BBChecklistInput = z.infer<typeof bbChecklistSchema>;
