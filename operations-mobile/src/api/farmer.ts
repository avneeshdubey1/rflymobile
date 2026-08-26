import { fetchApi } from './client';

export const farmerApi = {
  requestOtp: (phone: string) => 
    fetchApi('/api/mobile/v1/operations/auth/farmer/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
    
  verifyOtp: (phone: string, code: string) => 
    fetchApi('/api/mobile/v1/operations/auth/farmer/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
    
  getDashboard: () => 
    fetchApi('/api/mobile/v1/operations/farmer/dashboard', {}, undefined, { dataset: 'customerSummary', key: 'farmer_dashboard' }),
    
  submitRequest: (requestData: any) => 
    fetchApi('/api/mobile/v1/operations/farmer/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),
};
