import { fetchApi } from './client';

export const businessApi = {
  login: (email: string, password: string) => 
    fetchApi('/api/mobile/v1/operations/auth/business/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    
  getDashboard: () => 
    fetchApi('/api/mobile/v1/operations/business/dashboard', {}, undefined, { dataset: 'businessLinkedData', key: 'dashboard' }),
    
  getLinkedRequests: () => 
    fetchApi('/api/mobile/v1/operations/business/requests', {}, undefined, { dataset: 'businessLinkedData', key: 'requests' }),
    
  getNotifications: () => 
    fetchApi('/api/mobile/v1/operations/business/notifications', {}, undefined, { dataset: 'businessLinkedData', key: 'notifications' }),
    
  getProfile: () => 
    fetchApi('/api/mobile/v1/operations/business/profile', {}, undefined, { dataset: 'businessLinkedData', key: 'profile' }),
};
