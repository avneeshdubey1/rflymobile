import { create } from "zustand";
import * as SecureStore from "../lib/storage";
import * as Crypto from "expo-crypto";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { api, fetchTyped, setApiCallbacks } from "../lib/api";
import {
  ZLoginResponse,
  ZBootstrapResponse,
  ZPilotProfile,
  PilotProfile,
  OperatingCenter,
  ZCapability,
  ZPilotAvailabilityResponse,
} from "../contracts/mobile-api";
import { z } from "zod";
import {
  initDatabase,
  purgeDatabase,
  saveAssignments,
  setCursor,
} from "../lib/database";

export type AuthStateStatus =
  | "INITIALIZING"
  | "UNAUTHENTICATED"
  | "AUTHENTICATING"
  | "BOOTSTRAPPING"
  | "READY"
  | "UPGRADE_REQUIRED"
  | "REVOKED";

interface AuthState {
  status: AuthStateStatus;
  profile: PilotProfile | null;
  operatingCenter: OperatingCenter | null;
  capabilities: z.infer<typeof ZCapability>[];
  featureFlags: z.infer<typeof ZBootstrapResponse>["featureFlags"] | null;
  policies: z.infer<typeof ZBootstrapResponse>["policies"] | null;
  installationKey: string | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  handleUnauthorized: () => void;
  handleUpgradeRequired: () => void;
  setPilotAvailability: (state: "AVAILABLE" | "OFFLINE") => Promise<void>;
}

const STORE_KEYS = {
  ACCESS_TOKEN: "rfly_access_token",
  INSTALLATION_KEY: "rfly_installation_key",
  PROFILE_CACHE: "rfly_profile_cache",
};

async function getOrGenerateInstallationKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(STORE_KEYS.INSTALLATION_KEY);
  if (!key) {
    key = Crypto.randomUUID();
    await SecureStore.setItemAsync(STORE_KEYS.INSTALLATION_KEY, key);
  }
  return key;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "INITIALIZING",
  profile: null,
  operatingCenter: null,
  capabilities: [],
  featureFlags: null,
  policies: null,
  installationKey: null,
  error: null,

  initialize: async () => {
    try {
      const installationKey = await getOrGenerateInstallationKey();
      const token = await SecureStore.getItemAsync(STORE_KEYS.ACCESS_TOKEN);
      const cachedProfileRaw = await SecureStore.getItemAsync(
        STORE_KEYS.PROFILE_CACHE,
      );

      let profile: PilotProfile | null = null;
      if (cachedProfileRaw) {
        try {
          const parsedProfile = ZPilotProfile.safeParse(
            JSON.parse(cachedProfileRaw),
          );
          profile = parsedProfile.success ? parsedProfile.data : null;
        } catch {
          profile = null;
        }
      }

      if (token) {
        set({ status: "BOOTSTRAPPING", installationKey, profile });
        try {
          const bootstrapRes = await fetchTyped(
            ZBootstrapResponse,
            api.get("/pilot/bootstrap"),
          );

          if (bootstrapRes.app !== "PILOT_FIELD") {
            throw new Error("This app is restricted to Field Pilots.");
          }

          // Update cache with fresh profile
          await SecureStore.setItemAsync(
            STORE_KEYS.PROFILE_CACHE,
            JSON.stringify(bootstrapRes.profile),
          );
          await initDatabase(bootstrapRes.profile.id);
          await saveAssignments(
            bootstrapRes.profile.id,
            bootstrapRes.assignments,
          );
          await setCursor(bootstrapRes.profile.id, bootstrapRes.sync.cursor);

          set({
            status: "READY",
            profile: bootstrapRes.profile,
            operatingCenter: bootstrapRes.operatingCenter,
            capabilities: bootstrapRes.capabilities,
            featureFlags: bootstrapRes.featureFlags,
            policies: bootstrapRes.policies,
            error: null,
          });
        } catch (e: any) {
          // If network error, we can still stay READY if we have a cached profile (offline mode)
          // But for strict security, if it's a 401 or 426, the interceptor will handle it
          if (
            e?.code === "AUTHENTICATION_REQUIRED" ||
            e?.code === "SESSION_REVOKED"
          ) {
            get().handleUnauthorized();
          } else if (e?.code === "CLIENT_UPGRADE_REQUIRED") {
            get().handleUpgradeRequired();
          } else if (e?.retryable && profile) {
            await initDatabase(profile.id);
            set({
              status: "READY",
              profile,
              error: "Offline mode: showing securely cached work.",
            });
          } else {
            await SecureStore.deleteItemAsync(STORE_KEYS.ACCESS_TOKEN);
            set({
              status: "UNAUTHENTICATED",
              profile: null,
              operatingCenter: null,
              capabilities: [],
              featureFlags: null,
              policies: null,
              error: e.message || "Failed to bootstrap session.",
            });
          }
        }
      } else {
        set({
          status: "UNAUTHENTICATED",
          installationKey,
          profile: null,
          operatingCenter: null,
        });
      }
    } catch (e) {
      set({
        status: "UNAUTHENTICATED",
        error: "Failed to initialize app securely.",
      });
    }
  },

  login: async (email, password) => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      const installationKey = await getOrGenerateInstallationKey();

      const payload = {
        email,
        password,
        installationKey,
        platform: "ANDROID",
        appVersion: Application.nativeApplicationVersion || "1.0.0",
        deviceLabel: `${Platform.OS} ${Platform.Version}`,
      };

      const loginRes = await fetchTyped(
        ZLoginResponse,
        api.post("/pilot/auth/login", payload),
      );

      if (loginRes.profile.role !== "PILOT") {
        throw new Error("This app is restricted to Field Pilots.");
      }

      await SecureStore.setItemAsync(
        STORE_KEYS.ACCESS_TOKEN,
        loginRes.session.accessToken,
      );
      await SecureStore.setItemAsync(
        STORE_KEYS.PROFILE_CACHE,
        JSON.stringify(loginRes.profile),
      );

      set({ status: "BOOTSTRAPPING", profile: loginRes.profile });

      // Run bootstrap
      const bootstrapRes = await fetchTyped(
        ZBootstrapResponse,
        api.get("/pilot/bootstrap"),
      );
      await initDatabase(bootstrapRes.profile.id);
      await saveAssignments(bootstrapRes.profile.id, bootstrapRes.assignments);
      await setCursor(bootstrapRes.profile.id, bootstrapRes.sync.cursor);

      set({
        status: "READY",
        profile: bootstrapRes.profile,
        operatingCenter: bootstrapRes.operatingCenter,
        capabilities: bootstrapRes.capabilities,
        featureFlags: bootstrapRes.featureFlags,
        policies: bootstrapRes.policies,
        error: null,
      });
    } catch (e: any) {
      await SecureStore.deleteItemAsync(STORE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORE_KEYS.PROFILE_CACHE);
      set({
        status:
          e?.code === "CLIENT_UPGRADE_REQUIRED"
            ? "UPGRADE_REQUIRED"
            : "UNAUTHENTICATED",
        profile: null,
        operatingCenter: null,
        capabilities: [],
        featureFlags: null,
        policies: null,
        error: e?.message || "Login failed",
      });
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // Best effort
    } finally {
      const currentProfile = get().profile;
      if (currentProfile) {
        await purgeDatabase(currentProfile.id);
      }
      await SecureStore.deleteItemAsync(STORE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORE_KEYS.PROFILE_CACHE);
      // We don't delete installationKey
      set({
        status: "UNAUTHENTICATED",
        profile: null,
        operatingCenter: null,
        capabilities: [],
        featureFlags: null,
        policies: null,
        error: null,
      });
    }
  },

  logoutAll: async () => {
    try {
      await api.post("/auth/logout-all");
    } catch (e) {
      // Best effort
    } finally {
      const currentProfile = get().profile;
      if (currentProfile) {
        await purgeDatabase(currentProfile.id);
      }
      await SecureStore.deleteItemAsync(STORE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORE_KEYS.PROFILE_CACHE);
      set({
        status: "UNAUTHENTICATED",
        profile: null,
        operatingCenter: null,
        capabilities: [],
        featureFlags: null,
        policies: null,
        error: null,
      });
    }
  },

  handleUnauthorized: () => {
    // Purge token, it's revoked
    SecureStore.deleteItemAsync(STORE_KEYS.ACCESS_TOKEN).catch(() => {});
    const currentProfile = get().profile;
    if (currentProfile) {
      purgeDatabase(currentProfile.id).catch(() => {});
    }
    set({
      status: "REVOKED",
      profile: null,
      operatingCenter: null,
      capabilities: [],
      featureFlags: null,
      policies: null,
      error: "Your session ended. Sign in again.",
    });
  },

  handleUpgradeRequired: () => {
    set({ status: "UPGRADE_REQUIRED" });
  },

  setPilotAvailability: async (state) => {
    const response = await fetchTyped(
      ZPilotAvailabilityResponse,
      api.put("/pilot/availability", { state }),
    );
    await SecureStore.setItemAsync(
      STORE_KEYS.PROFILE_CACHE,
      JSON.stringify(response.profile),
    );
    set({ profile: response.profile, error: null });
  },
}));

// Wire up API interceptors to store actions
setApiCallbacks({
  onUnauthenticated: () => useAuthStore.getState().handleUnauthorized(),
  onUpgradeRequired: () => useAuthStore.getState().handleUpgradeRequired(),
});
