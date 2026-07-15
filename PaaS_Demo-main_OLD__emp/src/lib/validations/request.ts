import { z } from 'zod';

export const createRequestSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  customerType: z.enum(['BB', 'BC']),
  cropType: z.string().min(2, 'Crop type must be at least 2 characters'),
  fieldAreaAcres: z.number().positive('Field area must be greater than 0'),
  requestedDate: z.string().min(1, 'Requested date is required'),
  requestedTimeSlot: z.string().min(1, 'Requested time slot is required'),
  chemical: z.string().optional(),
  sourceOfRequest: z.enum(['WalkIn', 'Phone', 'WhatsApp', 'PartnerReferral', 'Other']),
  notes: z.string().optional(),
  amountPerAcre: z.number().positive('Amount per acre must be positive'),
});

export const representativeApprovalSchema = z.object({
  representativeName: z.string().min(2, 'Representative name is required'),
  representativePhone: z.string().min(10, 'Representative phone is required'),
  isApproved: z.boolean(),
  rejectionReason: z.string().optional(),
});

export const bcPaymentSchema = z.object({
  upiTransactionRef: z.string().min(4, 'Transaction reference is required'),
  amountPaid: z.number().positive('Amount should be positive'),
});
