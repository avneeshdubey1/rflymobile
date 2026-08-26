import { fetchApi } from './client';

export const businessApi = {
  login: (email: string, password: string) => 
    fetchApi('/api/mobile/v1/operations/auth/business/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    
  getDashboard: () => 
    fetchApi('/api/mobile/v1/operations/business/dashboard'), // Assuming a dashboard endpoint exists
    
  getLinkedRequests: () => 
    fetchApi('/api/mobile/v1/operations/business/requests'),
    
  getNotifications: () => 
    fetchApi('/api/mobile/v1/operations/business/notifications'),
    
  getProfile: () => 
    fetchApi('/api/mobile/v1/operations/business/profile'),
};
