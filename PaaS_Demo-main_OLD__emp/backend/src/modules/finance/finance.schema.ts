import { z } from 'zod';

export const generateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID required'),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
