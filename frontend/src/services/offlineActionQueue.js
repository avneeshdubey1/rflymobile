const DATABASE = 'field-operations-pilot-offline-actions';
const DATABASE_VERSION = 2;
const STORE = 'actions';
const ACTION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIONS_PER_USER = 100;

function requireUserId(userId) {
  const normalized = String(userId || '').trim();
  if (!normalized) throw new Error('A signed-in user is required for offline actions.');
  return normalized;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function allQueuedActions() {
  return withStore('readonly', (store) => store.getAll());
}

export function removeQueuedAction(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

async function removeActions(actions) {
  await Promise.all(actions.map((action) => removeQueuedAction(action.id)));
}

function isExpired(action, now = Date.now()) {
  const expiresAt = Date.parse(action.expiresAt || '');
  const createdAt = Date.parse(action.createdAt || '');
  if (Number.isFinite(expiresAt)) return expiresAt <= now;
  return !Number.isFinite(createdAt) || createdAt + ACTION_TTL_MS <= now;
}

async function activeActions() {
  const actions = await allQueuedActions();
  // Version-one records have no owner. They cannot safely be attributed to a
  // person, so discard them rather than replaying them under the next login.
  const unsafe = actions.filter((action) => !action.ownerUserId || isExpired(action));
  if (unsafe.length) await removeActions(unsafe);
  return actions.filter((action) => action.ownerUserId && !isExpired(action));
}

function locationBody(action, capturedAt) {
  const accuracy = Number(action.body?.accuracy);
  return {
    ...(action.body || {}),
    capturedAt: action.body?.capturedAt || capturedAt,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
  };
}

export async function queueAction(userId, action) {
  const ownerUserId = requireUserId(userId);
  if (!action?.assignmentId || !action?.url || !action?.kind) throw new Error('The offline action is incomplete.');
  const createdAt = new Date().toISOString();
  let actions = await activeActions();
  const owned = actions.filter((item) => item.ownerUserId === ownerUserId);

  if (action.kind === 'location') {
    const superseded = owned.filter((item) => item.kind === 'location' && item.assignmentId === action.assignmentId);
    if (superseded.length) {
      await removeActions(superseded);
      actions = actions.filter((item) => !superseded.some((old) => old.id === item.id));
    }
  }

  const remainingOwned = actions.filter((item) => item.ownerUserId === ownerUserId);
  if (remainingOwned.length >= MAX_ACTIONS_PER_USER) {
    const oldestLocation = remainingOwned.find((item) => item.kind === 'location');
    if (!oldestLocation) throw new Error('The offline queue is full. Reconnect before recording another action.');
    await removeQueuedAction(oldestLocation.id);
  }

  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const record = {
    ...action,
    body: action.kind === 'location' ? locationBody(action, createdAt) : (action.body || {}),
    id,
    ownerUserId,
    createdAt,
    expiresAt: new Date(Date.now() + ACTION_TTL_MS).toISOString(),
  };
  await withStore('readwrite', (store) => store.add(record));
  return record;
}

export async function queuedActions(userId) {
  const ownerUserId = requireUserId(userId);
  const items = await activeActions();
  return items
    .filter((item) => item.ownerUserId === ownerUserId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearQueuedActions(userId) {
  const ownerUserId = requireUserId(userId);
  const actions = await allQueuedActions();
  await removeActions(actions.filter((action) => action.ownerUserId === ownerUserId || !action.ownerUserId));
}

export async function flushQueuedActions(userId) {
  const ownerUserId = requireUserId(userId);
  const actions = await queuedActions(ownerUserId);
  const result = { sent: 0, discarded: 0, remaining: actions.length, error: null };
  for (const action of actions) {
    // Defense in depth: even a malformed IndexedDB record cannot cross users.
    if (action.ownerUserId !== ownerUserId) continue;
    try {
      const response = await fetch(action.url, {
        method: action.method || 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body || {}),
      });
      if (response.ok) {
        await removeQueuedAction(action.id);
        result.sent += 1;
        result.remaining -= 1;
      } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        await removeQueuedAction(action.id);
        result.discarded += 1;
        result.remaining -= 1;
      } else {
        result.error = 'The server is not ready to receive queued actions yet.';
        break;
      }
    } catch {
      result.error = 'Still offline. Queued actions are safely retained for this account.';
      break;
    }
  }
  return result;
}

export const offlineQueuePolicy = Object.freeze({ actionTtlMs: ACTION_TTL_MS, maxActionsPerUser: MAX_ACTIONS_PER_USER });
