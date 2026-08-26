import { SyncQueue } from './SyncQueue';
import * as SecureStore from 'expo-secure-store';

export async function networkRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, options);
    
    // Cache successful GET requests for offline mode
    if (response.ok && (!options.method || options.method === 'GET')) {
      const clone = response.clone();
      const data = await clone.json();
      await SecureStore.setItemAsync(`cache_${url}`, JSON.stringify(data));
    }

    return response;
  } catch (error) {
    // Network failure
    if (options.method && options.method !== 'GET') {
      // Queue mutations
      await SyncQueue.add(url, options);
      throw { status: 0, data: { error: { message: 'Network offline. Request queued for sync.' } } };
    } else {
      // Try to read cache for GET requests
      const cached = await SecureStore.getItemAsync(`cache_${url}`);
      if (cached) {
        return new Response(cached, { status: 200 });
      }
      throw { status: 0, data: { error: { message: 'Network offline. No cached data available.' } } };
    }
  }
}
