const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;
const MINIMUM_PASSWORD_LENGTH = 12;
// bcrypt silently ignores input after 72 bytes. Reject longer UTF-8 input so
// two visibly different passwords can never authenticate as the same value.
const MAXIMUM_PASSWORD_BYTES = 72;
const MAXIMUM_PASSWORD_LENGTH = MAXIMUM_PASSWORD_BYTES;
// A cost-matched, non-account hash prevents the nonexistent-account login
// path from skipping bcrypt and becoming an obvious timing oracle.
const INVALID_ACCOUNT_PASSWORD_HASH = '$2b$12$MbLIO9wOZTFsVXszXRVYuOszpwtavOPdx8e1WUg7PT5jJ27mJKH9.';

function validatePassword(password) {
  if (typeof password !== 'string'
    || password.length < MINIMUM_PASSWORD_LENGTH
    || Buffer.byteLength(password, 'utf8') > MAXIMUM_PASSWORD_BYTES) {
    throw new Error(`Password must be between ${MINIMUM_PASSWORD_LENGTH} characters and ${MAXIMUM_PASSWORD_BYTES} UTF-8 bytes`);
  }
  return password;
}

async function hashPassword(password) {
  return bcrypt.hash(validatePassword(password), BCRYPT_COST);
}

async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string' || !/^\$2[aby]\$/.test(passwordHash)) return false;
  return bcrypt.compare(password, passwordHash);
}

function needsRehash(passwordHash) {
  try {
    return bcrypt.getRounds(passwordHash) < BCRYPT_COST;
  } catch {
    return true;
  }
}

module.exports = {
  BCRYPT_COST,
  INVALID_ACCOUNT_PASSWORD_HASH,
  MINIMUM_PASSWORD_LENGTH,
  MAXIMUM_PASSWORD_BYTES,
  MAXIMUM_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  needsRehash,
  validatePassword,
};
