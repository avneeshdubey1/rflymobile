import { fetchApi } from './client';
import { z } from 'zod';

export const LeadSchema = z.object({
  id: z.string(),
  status: z.string(),
  acreage: z.string(),
  crop: z.string().nullable(),
  operatingCenterId: z.string().optional().nullable(),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  phone: z.string(),
  preferredLanguage: z.string().optional().nullable(),
  ownership: z.string().optional().nullable(),
  totalAcres: z.string().optional().nullable(),
  location: z.object({
    village: z.string().optional().nullable(),
    mandal: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  }).optional().nullable(),
  recentLeads: z.array(LeadSchema).optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const SearchCustomersResponseSchema = z.object({
  success: z.boolean(),
  customers: z.array(CustomerSchema),
});

export const CheckDuplicateResponseSchema = z.object({
  success: z.boolean(),
  customer: CustomerSchema,
});

export const CreateCustomerResponseSchema = z.object({
  success: z.boolean(),
  created: z.boolean(),
  customer: CustomerSchema,
});

export const CreateLeadResponseSchema = z.object({
  success: z.boolean(),
  outcome: z.string(),
  lead: LeadSchema.optional(),
  assignmentOutcome: z.string().nullable(),
});

export interface CreateCustomerDto {
  displayName: string;
  phone: string;
  preferredLanguage?: string;
  ownership?: string;
  totalAcres?: number;
  village?: string;
  mandal?: string;
  district?: string;
  state?: string;
}

export interface CreateLeadDto {
  acreage: number;
  latitude: number;
  longitude: number;
  farmerAddress?: string;
  cropType: string;
  notes?: string;
  soilType?: string;
  cropAgeWeeks?: number;
  chemicalBrand?: string;
  sprayPurpose?: string;
  hasChemical?: boolean;
  chemicalProofUrl?: string;
  expectedDate?: string;
  expectedTime?: string;
  waterBodyNearby?: boolean;
  terrainType?: string;
}

export const salesApi = {
  searchCustomers: (query: string) => 
    fetchApi(`/api/mobile/v1/operations/sales/customers?q=${encodeURIComponent(query)}`, {}, SearchCustomersResponseSchema, { dataset: 'customerSummary', key: `search_${query}` }),

  checkDuplicatePhone: (phone: string) =>
    fetchApi(`/api/mobile/v1/operations/sales/customers/by-phone?phone=${encodeURIComponent(phone)}`, {}, CheckDuplicateResponseSchema, { dataset: 'customerSummary', key: `phone_${phone}` }),

  createCustomer: (customerData: CreateCustomerDto) => 
    fetchApi('/api/mobile/v1/operations/sales/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }, CreateCustomerResponseSchema),

  createLead: (customerId: string, leadData: CreateLeadDto) =>
    fetchApi(`/api/mobile/v1/operations/sales/customers/${customerId}/leads`, {
      method: 'POST',
      body: JSON.stringify(leadData),
    }, CreateLeadResponseSchema),
};
