const crypto = require('node:crypto');
const fs = require('node:fs');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KDF_SALT = Buffer.from('rfly-farmer-import-v1', 'utf8');

function configurationError(message) {
  const error = new Error(message);
  error.code = 'IMPORT_CRYPTO_CONFIGURATION_INVALID';
  return error;
}

function decodeKey(value) {
  const text = String(value || '').trim();
  if (/^[a-f0-9]{64}$/i.test(text)) return Buffer.from(text, 'hex');

  try {
    const decoded = Buffer.from(text, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/u, '') === text.replace(/=+$/u, '')) {
      return decoded;
    }
  } catch {
    // Fall through to the deliberately strict raw-key check below.
  }

  const raw = Buffer.from(text, 'utf8');
  if (raw.length === 32) return raw;
  throw configurationError('The import staging key must decode to exactly 32 bytes');
}

function loadKeyFromFile(filePath) {
  const path = String(filePath || '').trim();
  if (!path) throw configurationError('IMPORT_STAGING_KEY_FILE is required');
  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch {
    throw configurationError('The import staging key file is not readable');
  }
  return decodeKey(raw);
}

function aadFor(record) {
  return Buffer.from(`${record.batchId}:${record.sheetName}:${record.sourceRowNumber}`, 'utf8');
}

function derivePurposeKey(masterKey, purpose) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) {
    throw configurationError('A 32-byte import staging key is required');
  }
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, KDF_SALT, Buffer.from(String(purpose), 'utf8'), 32));
}

function encryptPayload(payload, key, record) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw configurationError('A 32-byte import staging key is required');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, derivePurposeKey(key, 'aes-256-gcm'), iv);
  cipher.setAAD(aadFor(record));
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encryptedPayload = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    encryptedPayload,
    payloadIv: iv,
    payloadAuthTag: cipher.getAuthTag(),
  };
}

function decryptPayload(record, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw configurationError('A 32-byte import staging key is required');
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, derivePurposeKey(key, 'aes-256-gcm'), Buffer.from(record.payloadIv));
    decipher.setAAD(aadFor(record));
    decipher.setAuthTag(Buffer.from(record.payloadAuthTag));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedPayload)),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    const error = new Error('The staged import payload could not be authenticated');
    error.code = 'IMPORT_PAYLOAD_AUTHENTICATION_FAILED';
    throw error;
  }
}

function phoneFingerprint(phone, key) {
  return crypto.createHmac('sha256', derivePurposeKey(key, 'phone-fingerprint')).update(String(phone), 'utf8').digest('hex');
}

module.exports = {
  decodeKey,
  decryptPayload,
  derivePurposeKey,
  encryptPayload,
  loadKeyFromFile,
  phoneFingerprint,
};
