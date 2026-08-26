import { fetchApi } from './client';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  village?: string;
  district?: string;
}

export interface Lead {
  id: string;
  customerId: string;
  status: string;
}

export const salesApi = {
  searchCustomers: (query: string) => 
    fetchApi(`/api/mobile/v1/operations/sales/customers?q=${encodeURIComponent(query)}`),

  checkDuplicatePhone: (phone: string) =>
    fetchApi(`/api/mobile/v1/operations/sales/customers/by-phone?phone=${encodeURIComponent(phone)}`),

  createCustomer: (customerData: any) => 
    fetchApi('/api/mobile/v1/operations/sales/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }),

  createLead: (customerId: string, leadData: any) =>
    fetchApi(`/api/mobile/v1/operations/sales/customers/${customerId}/leads`, {
      method: 'POST',
      body: JSON.stringify(leadData),
    }),
};
