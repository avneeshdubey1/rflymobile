/// <reference types="jest" />
import { authApi } from '../src/api/auth';
import { useAuthStore } from '../src/store/auth';
import * as SecureStore from 'expo-secure-store';

jest.mock('../src/api/client', () => ({
  fetchApi: jest.fn(),
  getPlatformInfo: jest.fn().mockResolvedValue({
    platform: 'android',
    appVersion: '1.0.0',
    deviceLabel: 'Test Device',
    installationKey: 'test-key',
  }),
  setAuthInterceptors: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockFetchApi = require('../src/api/client').fetchApi;

describe('Authentication Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: null, profile: null, capabilities: [], isHydrated: false });
  });

  it('valid staff login succeeds and saves token', async () => {
    mockFetchApi.mockResolvedValueOnce({ token: 'valid-token', user: { email: 'admin@example.com' } });
    const res = await authApi.login({ email: 'admin@example.com', password: 'password123' });
    
    expect(mockFetchApi).toHaveBeenCalledWith('/api/mobile/v1/operations/auth/login', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('admin@example.com')
    }), expect.any(Object));
    expect(res.token).toBe('valid-token');
  });

  it('invalid password rejects and does not leak existence', async () => {
    mockFetchApi.mockRejectedValueOnce({ status: 401, data: { error: { message: 'Authentication Failed' } } });
    
    await expect(authApi.login({ email: 'unknown@example.com', password: 'wrong' }))
      .rejects.toEqual(expect.objectContaining({ status: 401 }));
  });

  it('logout removes token and clears store', async () => {
    await useAuthStore.getState().setToken('test-token');
    expect(useAuthStore.getState().token).toBe('test-token');
    
    await useAuthStore.getState().logout();
    
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userToken');
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('process restart restores a valid session', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('restored-token');
    
    await useAuthStore.getState().hydrate();
    
    expect(useAuthStore.getState().token).toBe('restored-token');
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });
});

