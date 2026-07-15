const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;
const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 128;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MINIMUM_PASSWORD_LENGTH || password.length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(`Password must be between ${MINIMUM_PASSWORD_LENGTH} and ${MAXIMUM_PASSWORD_LENGTH} characters`);
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
  MINIMUM_PASSWORD_LENGTH,
  MAXIMUM_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  needsRehash,
  validatePassword,
};
