import * as SecureStore from "./storage";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";

const KEY_PREFIX = "rfly_db_key_";

/**
 * Gets or generates a strong encryption key for a specific profile ID.
 * Stores the key securely in the device's keychain/keystore.
 */
export async function getOrGenerateDbKey(profileId: string): Promise<string> {
  const storeKey = `${KEY_PREFIX}${profileId}`;
  let key = await SecureStore.getItemAsync(storeKey);

  if (!key) {
    // Generate a strong key (using UUIDv4 multiple times or Crypto.getRandomBytesAsync)
    // expo-crypto getRandomBytesAsync is better for AES keys.
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    // Convert to hex string or base64 to store in SecureStore
    key = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await SecureStore.setItemAsync(storeKey, key);
  }

  return key;
}

/**
 * Encrypts a JSON payload using AES.
 */
export function encryptPayload(payload: any, key: string): string {
  const jsonString = JSON.stringify(payload);
  return CryptoJS.AES.encrypt(jsonString, key).toString();
}

/**
 * Decrypts an AES ciphertext and parses the JSON payload.
 */
export function decryptPayload<T>(ciphertext: string, key: string): T {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedString) {
    throw new Error(
      "Failed to decrypt payload (invalid key or corrupted data).",
    );
  }

  return JSON.parse(decryptedString) as T;
}

/**
 * Deletes the encryption key for a specific profile.
 * Use this during profile purge/revocation to crypto-shred the database.
 */
export async function purgeDbKey(profileId: string): Promise<void> {
  const storeKey = `${KEY_PREFIX}${profileId}`;
  await SecureStore.deleteItemAsync(storeKey);
}
