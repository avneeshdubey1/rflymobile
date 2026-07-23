const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAXIMUM_PASSWORD_BYTES,
  hashPassword,
  validatePassword,
  verifyPassword,
} = require('../services/passwordService');

test('password validation rejects input that bcrypt would silently truncate', async () => {
  const sharedBcryptPrefix = 'a'.repeat(MAXIMUM_PASSWORD_BYTES);
  assert.throws(
    () => validatePassword(`${sharedBcryptPrefix}first-suffix`),
    /72 UTF-8 bytes/,
  );
  await assert.rejects(
    hashPassword(`${sharedBcryptPrefix}second-suffix`),
    /72 UTF-8 bytes/,
  );
});

test('password validation enforces the byte limit for multibyte UTF-8 input', async () => {
  const exactlySeventyTwoBytes = '🙂'.repeat(18);
  const overSeventyTwoBytes = '🙂'.repeat(19);
  assert.equal(Buffer.byteLength(exactlySeventyTwoBytes, 'utf8'), MAXIMUM_PASSWORD_BYTES);
  assert.equal(validatePassword(exactlySeventyTwoBytes), exactlySeventyTwoBytes);
  assert.throws(() => validatePassword(overSeventyTwoBytes), /72 UTF-8 bytes/);

  const hash = await hashPassword(exactlySeventyTwoBytes);
  assert.equal(await verifyPassword(exactlySeventyTwoBytes, hash), true);
  assert.equal(await verifyPassword(`${'🙂'.repeat(17)}different`, hash), false);
});
