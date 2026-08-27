import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { purgeUserCache } from '../storage/cache';
import type { MobileProfile } from '../api/auth';
import { setLanguage } from '../i18n/farmer';

const TOKEN_KEY = 'userToken';

interface AuthState {
  token: string | null;
  profile: MobileProfile | null;
  capabilities: string[];
  isHydrated: boolean;
  setToken: (token: string) => Promise<void>;
  setProfile: (profile: MobileProfile, capabilities: string[]) => void;
  establishSession: (token: string, profile: MobileProfile, capabilities: string[]) => Promise<void>;
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

  setProfile: (profile: MobileProfile, capabilities: string[]) => {
    setLanguage(profile.preferredLanguage);
    set({ profile, capabilities });
  },

  establishSession: async (token: string, profile: MobileProfile, capabilities: string[]) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setLanguage(profile.preferredLanguage);
    set({ token, profile, capabilities });
  },

  logout: async () => {
    const currentProfile = get().profile;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    if (currentProfile?.id) {
      await purgeUserCache(currentProfile.id);
    }
    setLanguage('en');
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
