import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

const MASTER_KEY_ALIAS = 'app_cache_master_key';

interface CacheEntry {
  data: any;
  timestamp: number;
  userId: string;
}

interface CacheConfig {
  ttl: number; // milliseconds
  maxSize?: number; // max number of items for collection caches
}

const CACHE_RULES: Record<string, CacheConfig> = {
  customerSummary: { ttl: 24 * 60 * 60 * 1000 },
  salesDrafts: { ttl: 7 * 24 * 60 * 60 * 1000 },
  farmerDrafts: { ttl: 7 * 24 * 60 * 60 * 1000 },
  businessLinkedData: { ttl: 60 * 60 * 1000 } // 1 hour if approved
};

async function cacheStorageKey(dataset: string, key: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${dataset}:${key}`,
  );
  return `@cache_${dataset}_${digest}`;
}

async function getMasterKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
  if (!key) {
    key = Crypto.randomUUID();
    await SecureStore.setItemAsync(MASTER_KEY_ALIAS, key);
  }
  return key;
}

export async function setCache(dataset: string, key: string, data: any, userId: string): Promise<void> {
  const masterKey = await getMasterKey();
  const payload: CacheEntry = {
    data,
    timestamp: Date.now(),
    userId
  };
  
  const json = JSON.stringify(payload);
  const encrypted = CryptoJS.AES.encrypt(json, masterKey).toString();
  await AsyncStorage.setItem(await cacheStorageKey(dataset, key), encrypted);
}

export async function getCache(dataset: string, key: string, userId: string): Promise<{ data: any, isStale: boolean } | null> {
  const masterKey = await getMasterKey();
  const encrypted = await AsyncStorage.getItem(await cacheStorageKey(dataset, key));
  if (!encrypted) return null;

  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, masterKey);
    const json = bytes.toString(CryptoJS.enc.Utf8);
    const payload: CacheEntry = JSON.parse(json);

    if (payload.userId !== userId) {
      return null;
    }

    const rule = CACHE_RULES[dataset];
    const isStale = rule ? (Date.now() - payload.timestamp > rule.ttl) : false;

    return { data: payload.data, isStale };
  } catch (err) {
    return null;
  }
}

export async function removeCache(dataset: string, key: string): Promise<void> {
  await AsyncStorage.removeItem(await cacheStorageKey(dataset, key));
}

export async function purgeUserCache(userId: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('@cache_'));
    const masterKey = await getMasterKey();

    for (const key of cacheKeys) {
      const encrypted = await AsyncStorage.getItem(key);
      if (encrypted) {
        try {
          const bytes = CryptoJS.AES.decrypt(encrypted, masterKey);
          const json = bytes.toString(CryptoJS.enc.Utf8);
          const payload: CacheEntry = JSON.parse(json);
          if (payload.userId === userId) {
            await AsyncStorage.removeItem(key);
          }
        } catch {
          // If decryption fails, just wipe it to be safe
          await AsyncStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to purge user cache', error);
  }
}
