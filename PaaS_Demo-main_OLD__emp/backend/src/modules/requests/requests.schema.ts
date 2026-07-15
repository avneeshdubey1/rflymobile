import { z } from 'zod';

export const createRequestSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerType: z.enum(['BB', 'BC']),
  cropType: z.string().min(1, 'Crop type is required'),
  fieldAreaAcres: z.number().positive('Field area must be positive'),
  requestedDate: z.string().min(1, 'Date is required'),
  requestedTimeSlot: z.string().min(1, 'Time slot is required'),
  chemical: z.string().optional().default(''),
  sourceOfRequest: z.enum(['WalkIn', 'Phone', 'WhatsApp', 'PartnerReferral', 'Other']).default('WalkIn'),
  amountPerAcre: z.number().positive().default(650),
  notes: z.string().optional().default(''),
});

export const listRequestsQuerySchema = z.object({
  status: z.string().optional(),
  customerType: z.enum(['BB', 'BC']).optional(),
  search: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
