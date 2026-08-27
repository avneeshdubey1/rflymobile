import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { classifyError } from './errors';
import { ZodType } from 'zod';
import { useAuthStore } from '../store/auth';
import { getCache, setCache } from '../storage/cache';

const BASE_URL = process.env.EXPO_PUBLIC_OC_API_URL || 'http://localhost:3000';
const INSTALLATION_KEY_STORE = 'installationKey';
const TOKEN_KEY = 'userToken';

export async function getInstallationKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(INSTALLATION_KEY_STORE);
  if (!key) {
    key = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_KEY_STORE, key);
  }
  return key;
}

export async function getPlatformInfo() {
  return {
    platform: Platform.OS.toUpperCase(),
    appVersion: Application.nativeApplicationVersion || '1.0.0',
    deviceLabel: Device.modelName || 'Unknown Device',
    installationKey: await getInstallationKey(),
  };
}

export let onAuthFailure: () => void; export let onUpgradeRequired: () => void; export function setAuthInterceptors(onAuth: () => void, onUpgrade: () => void) { onAuthFailure = onAuth; onUpgradeRequired = onUpgrade; }

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}, schema?: ZodType<T>, cacheConfig?: { dataset: string, key: string }): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userId = useAuthStore.getState().profile?.id;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': Application.nativeApplicationVersion || '1.0.0',
    'X-Platform': Platform.OS,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  let isOffline = false;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error) {
    isOffline = true;
  }

  if (isOffline) {
    if (cacheConfig && userId && (!options.method || options.method === 'GET')) {
      const cached = await getCache(cacheConfig.dataset, cacheConfig.key, userId);
      if (cached) {
        return (cached.isStale && cached.data && typeof cached.data === 'object'
          ? { ...cached.data, _isStale: true }
          : cached.data) as T;
      }
    }
    throw classifyError(0, { error: { message: 'Network offline' } });
  }

  const contentType = response!.headers.get('content-type');
  let data: any = {};
  if (contentType && contentType.includes('application/json')) {
    data = await response!.json().catch(() => ({}));
  }

  if (response!.status === 401 && onAuthFailure) onAuthFailure(); 
  if (response!.status === 426 && onUpgradeRequired) onUpgradeRequired(); 
  if (!response!.ok) {
    throw classifyError(response!.status, data);
  }

  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw classifyError(500, { error: { message: 'Invalid response schema from server' } });
    } else {
      data = result.data;
    }
  }

  if (cacheConfig && userId && (!options.method || options.method === 'GET')) {
    await setCache(cacheConfig.dataset, cacheConfig.key, data, userId);
  }

  return data as T;
}
