import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'userToken';
const PROFILE_KEY = 'userProfile';

export const authStore = {
  async saveToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async getToken() {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },
  async removeToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
  async saveProfile(profile: any) {
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  },
  async getProfile() {
    const profile = await SecureStore.getItemAsync(PROFILE_KEY);
    return profile ? JSON.parse(profile) : null;
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PROFILE_KEY);
  }
};
