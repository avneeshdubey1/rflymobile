import { encryptPayload, decryptPayload } from "../src/lib/encryption";
import { getDbName, purgeDatabase } from "../src/lib/database";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";

describe("Encryption & Storage Scope", () => {
  it("encrypts and decrypts payload correctly", () => {
    const key = "test-key-32-bytes-long-string-12";
    const payload = { id: "123", secret: "abc" };

    const cipher = encryptPayload(payload, key);
    expect(cipher).not.toContain("123"); // Should be encrypted
    expect(cipher).not.toContain("abc");

    const decrypted = decryptPayload(cipher, key);
    expect(decrypted).toEqual(payload);
  });

  it("fails decryption with wrong key", () => {
    const key = "test-key-32-bytes-long-string-12";
    const wrongKey = "wrong-key-32-bytes-long-string-1";
    const payload = { id: "123", secret: "abc" };

    const cipher = encryptPayload(payload, key);

    expect(() => {
      decryptPayload(cipher, wrongKey);
    }).toThrow();
  });

  it("getDbName isolates by profileId and sanitizes", () => {
    const dbName1 = getDbName("profile-1");
    const dbName2 = getDbName("profile-2");
    const dbNameUnsafe = getDbName("profile/with.unsafe*chars");

    expect(dbName1).toBe("pilot_field_profile-1.db");
    expect(dbName2).toBe("pilot_field_profile-2.db");
    expect(dbName1).not.toBe(dbName2);
    expect(dbNameUnsafe).toBe("pilot_field_profilewithunsafechars.db");
  });

  it("purgeDatabase closes and deletes the scoped database and key", async () => {
    await purgeDatabase("profile-1");
    expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith(
      "pilot_field_profile-1.db",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "rfly_db_key_profile-1",
    );
  });
});
