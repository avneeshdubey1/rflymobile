import * as SecureStore from 'expo-secure-store';

export const SyncQueue = {
  async add(endpoint: string, options: any) {
    const queueJson = await SecureStore.getItemAsync('syncQueue');
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    queue.push({
      id: Date.now().toString(),
      endpoint,
      options,
      timestamp: new Date().toISOString()
    });
    
    await SecureStore.setItemAsync('syncQueue', JSON.stringify(queue));
  },

  async getQueue() {
    const queueJson = await SecureStore.getItemAsync('syncQueue');
    return queueJson ? JSON.parse(queueJson) : [];
  },

  async remove(id: string) {
    const queueJson = await SecureStore.getItemAsync('syncQueue');
    if (!queueJson) return;
    
    const queue = JSON.parse(queueJson).filter((item: any) => item.id !== id);
    await SecureStore.setItemAsync('syncQueue', JSON.stringify(queue));
  }
};
