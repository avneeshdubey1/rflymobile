import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { purgeUserCache } from '../storage/cache';

const TOKEN_KEY = 'userToken';

interface AuthState {
  token: string | null;
  profile: any | null;
  capabilities: string[];
  isHydrated: boolean;
  setToken: (token: string) => Promise<void>;
  setProfile: (profile: any, capabilities: string[]) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  profile: null,
  capabilities: [],
  isHydrated: false,
  
  setToken: async (token: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token });
  },

  setProfile: (profile: any, capabilities: string[]) => {
    set({ profile, capabilities });
  },

  logout: async () => {
    const currentProfile = get().profile;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    if (currentProfile?.id) {
      await purgeUserCache(currentProfile.id);
    }
    set({ token: null, profile: null, capabilities: [] });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      set({ token });
    }
    set({ isHydrated: true });
    return token;
  }
}));
