import * as SQLite from "expo-sqlite";
import {
  Assignment,
  MutationReceipt,
  MutationRequest,
} from "../contracts/mobile-api";
import {
  getOrGenerateDbKey,
  encryptPayload,
  decryptPayload,
  purgeDbKey,
} from "./encryption";

const CURRENT_SCHEMA_VERSION = 2;

type Database = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

// expo-sqlite can reject native calls when the same file is repeatedly opened
// while initialization, synchronization, and React lifecycle work overlap.
// Keep exactly one handle and one initialization promise per profile.
const databasePromises = new Map<string, Promise<Database>>();
const initializationPromises = new Map<string, Promise<Database>>();

export interface MutationRecord {
  mutation: MutationRequest;
  status: string;
  receipt: MutationReceipt | null;
  createdAt: number;
  updatedAt: number;
}

export function getDbName(profileId: string): string {
  // Ensure profileId contains only safe characters for a filename
  const safeProfileId = profileId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `pilot_field_${safeProfileId}.db`;
}

/**
 * Initializes the database for a specific profile, running migrations if necessary.
 */
function openDatabase(profileId: string): Promise<Database> {
  const dbName = getDbName(profileId);
  const existing = databasePromises.get(dbName);
  if (existing) return existing;

  const opening = SQLite.openDatabaseAsync(dbName).catch((error) => {
    databasePromises.delete(dbName);
    throw error;
  });
  databasePromises.set(dbName, opening);
  return opening;
}

async function migrateDatabase(db: Database) {
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA busy_timeout = 5000");
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS schema_info (version INTEGER PRIMARY KEY)",
  );

  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT MAX(version) as version FROM schema_info",
  );
  let currentVersion = row?.version || 0;

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS assignments (
          id TEXT PRIMARY KEY,
          encrypted_data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS mutations (
          clientActionId TEXT PRIMARY KEY,
          assignmentId TEXT NOT NULL,
          action TEXT NOT NULL,
          encrypted_payload TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`);
      await db.runAsync("INSERT OR IGNORE INTO schema_info (version) VALUES (?)", 1);
    });
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(mutations)",
      );
      const names = new Set(columns.map(({ name }) => name));
      if (!names.has("encrypted_receipt")) {
        await db.execAsync(
          "ALTER TABLE mutations ADD COLUMN encrypted_receipt TEXT",
        );
      }
      if (!names.has("updated_at")) {
        await db.execAsync("ALTER TABLE mutations ADD COLUMN updated_at INTEGER");
      }
      await db.runAsync(
        "UPDATE mutations SET updated_at = created_at WHERE updated_at IS NULL",
      );
      await db.runAsync("INSERT OR IGNORE INTO schema_info (version) VALUES (?)", 2);
    });
  }
}

/**
 * Initializes the database for a specific profile, running migrations once.
 */
export async function initDatabase(profileId: string): Promise<Database> {
  const dbName = getDbName(profileId);
  const existing = initializationPromises.get(dbName);
  if (existing) return existing;

  const initializing = (async () => {
    const db = await openDatabase(profileId);
    await migrateDatabase(db);
    return db;
  })().catch((error) => {
    initializationPromises.delete(dbName);
    throw error;
  });

  initializationPromises.set(dbName, initializing);
  return initializing;
}

export const getDb = (profileId: string) => initDatabase(profileId);

// --- Assignment Helpers ---

export async function saveAssignments(
  profileId: string,
  assignments: Assignment[],
) {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);

  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      "INSERT OR REPLACE INTO assignments (id, encrypted_data, updated_at) VALUES ($id, $encrypted_data, $updated_at)",
    );
    try {
      for (const a of assignments) {
        const encryptedData = encryptPayload(a, key);
        await statement.executeAsync({
          $id: a.id,
          $encrypted_data: encryptedData,
          $updated_at: new Date(a.updatedAt).getTime(),
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

export async function getAssignments(profileId: string): Promise<Assignment[]> {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);

  const rows = await db.getAllAsync<{ encrypted_data: string }>(
    "SELECT encrypted_data FROM assignments ORDER BY updated_at DESC",
  );

  const assignments: Assignment[] = [];
  for (const r of rows) {
    try {
      assignments.push(decryptPayload<Assignment>(r.encrypted_data, key));
    } catch {
      // Ignore corrupt or foreign cache rows. The next authenticated bootstrap
      // replaces them without logging encrypted record context.
    }
  }
  return assignments;
}

export async function getAssignment(
  profileId: string,
  id: string,
): Promise<Assignment | null> {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);

  const row = await db.getFirstAsync<{ encrypted_data: string }>(
    "SELECT encrypted_data FROM assignments WHERE id = ?",
    [id],
  );
  if (!row) return null;

  try {
    return decryptPayload<Assignment>(row.encrypted_data, key);
  } catch (e) {
    return null;
  }
}

export async function deleteAssignments(profileId: string, ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb(profileId);
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM assignments WHERE id IN (${placeholders})`,
    ids,
  );
}

export async function clearAssignments(profileId: string) {
  const db = await getDb(profileId);
  await db.runAsync("DELETE FROM assignments");
}

// --- Metadata (Cursor) Helpers ---

export async function setCursor(profileId: string, cursor: string) {
  const db = await getDb(profileId);
  await db.runAsync(
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["sync_cursor", cursor],
  );
}

export async function getCursor(profileId: string): Promise<string> {
  const db = await getDb(profileId);
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = ?",
    ["sync_cursor"],
  );
  return row ? row.value : "";
}

// --- Mutation Queue Helpers ---

export async function insertMutation(
  profileId: string,
  mutation: MutationRequest,
) {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);
  const encryptedPayload = encryptPayload(mutation, key);

  await db.runAsync(
    "INSERT INTO mutations (clientActionId, assignmentId, action, encrypted_payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      mutation.clientActionId,
      mutation.assignmentId,
      mutation.action,
      encryptedPayload,
      "PENDING",
      Date.now(),
      Date.now(),
    ],
  );
}

export async function getPendingMutations(
  profileId: string,
  limit: number = 20,
): Promise<MutationRequest[]> {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);

  // We only fetch PENDING and RETRY_LATER mutations for transmission
  const rows = await db.getAllAsync<{ encrypted_payload: string }>(
    "SELECT encrypted_payload FROM mutations WHERE status IN (?, ?) ORDER BY created_at ASC LIMIT ?",
    ["PENDING", "RETRY_LATER", limit],
  );

  const mutations: MutationRequest[] = [];
  for (const r of rows) {
    try {
      mutations.push(decryptPayload<MutationRequest>(r.encrypted_payload, key));
    } catch {
      // Keep encrypted offline evidence behind a quiet failure boundary.
    }
  }
  return mutations;
}

export async function updateMutationStatus(
  profileId: string,
  clientActionId: string,
  status: string,
  receipt: MutationReceipt | null = null,
) {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);
  const encryptedReceipt = receipt ? encryptPayload(receipt, key) : null;
  await db.runAsync(
    "UPDATE mutations SET status = ?, encrypted_receipt = ?, updated_at = ? WHERE clientActionId = ?",
    [status, encryptedReceipt, Date.now(), clientActionId],
  );
}

export async function getMutationRecords(
  profileId: string,
): Promise<MutationRecord[]> {
  const db = await getDb(profileId);
  const key = await getOrGenerateDbKey(profileId);
  const rows = await db.getAllAsync<{
    encrypted_payload: string;
    encrypted_receipt: string | null;
    status: string;
    created_at: number;
    updated_at: number | null;
  }>(
    "SELECT encrypted_payload, encrypted_receipt, status, created_at, updated_at FROM mutations ORDER BY created_at DESC",
  );

  return rows.flatMap((row) => {
    try {
      return [
        {
          mutation: decryptPayload<MutationRequest>(row.encrypted_payload, key),
          status: row.status,
          receipt: row.encrypted_receipt
            ? decryptPayload<MutationReceipt>(row.encrypted_receipt, key)
            : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function deleteMutation(
  profileId: string,
  clientActionId: string,
) {
  const db = await getDb(profileId);
  await db.runAsync("DELETE FROM mutations WHERE clientActionId = ?", [
    clientActionId,
  ]);
}

// --- Lifecycle Helpers ---

/**
 * Purges the scoped database completely.
 * Deletes the SQLite file and the encryption key.
 */
export async function purgeDatabase(profileId: string) {
  const dbName = getDbName(profileId);
  const initialization = initializationPromises.get(dbName);
  const connection = databasePromises.get(dbName);
  initializationPromises.delete(dbName);
  databasePromises.delete(dbName);

  try {
    const db = await (initialization ?? connection);
    if (!db) throw new Error("Database was not open");
    await db.closeAsync();
  } catch {
    // The file may already be closed or absent. Deletion and crypto-shredding
    // remain mandatory and are attempted independently below.
  }

  try {
    await SQLite.deleteDatabaseAsync(dbName);
  } catch {
    // Crypto-shredding below is the final fail-closed erasure boundary.
  }

  // Crypto-shred the key
  await purgeDbKey(profileId);
}
