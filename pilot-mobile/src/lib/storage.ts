import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The web target exists only for local visual validation. Keeping session or
// database keys in localStorage would make bearer tokens persist in a browser,
// so web storage is deliberately memory-only and clears on refresh.
const webMemoryStore = new Map<string, string>();
const WEB_INSTALLATION_KEY = "rfly_installation_key";

function webSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (key === WEB_INSTALLATION_KEY) {
      return (
        webSessionStorage()?.getItem(key) ?? webMemoryStore.get(key) ?? null
      );
    }
    return webMemoryStore.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (key === WEB_INSTALLATION_KEY) {
      webSessionStorage()?.setItem(key, value);
    }
    webMemoryStore.set(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (key === WEB_INSTALLATION_KEY) {
      webSessionStorage()?.removeItem(key);
    }
    webMemoryStore.delete(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
