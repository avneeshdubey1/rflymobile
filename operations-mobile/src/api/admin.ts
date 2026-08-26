import { fetchApi } from './client';

export const adminApi = {
  // Users
  getUsers: () => fetchApi('/api/mobile/v1/operations/admin/users'),
  addUser: (data: any) => fetchApi('/api/mobile/v1/operations/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => fetchApi(`/api/mobile/v1/operations/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updatePilotCenter: (id: string, operatingCenterId: string) => fetchApi(`/api/mobile/v1/operations/admin/users/${id}/operating-center`, { method: 'PATCH', body: JSON.stringify({ operatingCenterId }) }),

  // Drones
  getDrones: () => fetchApi('/api/mobile/v1/operations/admin/drones'),
  addDrone: (data: any) => fetchApi('/api/mobile/v1/operations/admin/drones', { method: 'POST', body: JSON.stringify(data) }),
  updateDrone: (id: string, data: any) => fetchApi(`/api/mobile/v1/operations/admin/drones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // LMVs
  getLmvs: () => fetchApi('/api/mobile/v1/operations/admin/lmvs'),
  addLmv: (data: any) => fetchApi('/api/mobile/v1/operations/admin/lmvs', { method: 'POST', body: JSON.stringify(data) }),
  updateLmv: (id: string, data: any) => fetchApi(`/api/mobile/v1/operations/admin/lmvs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Phase 6C
  getRegions: () => fetchApi('/api/mobile/v1/operations/admin/regions'),
  addRegion: (data: any) => fetchApi('/api/mobile/v1/operations/admin/regions', { method: 'POST', body: JSON.stringify(data) }),
  
  getPolicies: () => fetchApi('/api/mobile/v1/operations/admin/policies'),
  updatePolicy: (data: any) => fetchApi('/api/mobile/v1/operations/admin/policies', { method: 'PUT', body: JSON.stringify(data) }),
  
  getMasterData: () => fetchApi('/api/mobile/v1/operations/admin/master-data'),
};
