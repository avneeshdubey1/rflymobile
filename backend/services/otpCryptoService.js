const crypto = require('crypto');

let developmentHashSecret;

function secret(config) {
  if (config.otp.hashSecret) return config.otp.hashSecret;
  if (!developmentHashSecret) developmentHashSecret = crypto.randomBytes(48).toString('base64url');
  return developmentHashSecret;
}

function hmac(config, value) {
  return crypto.createHmac('sha256', secret(config)).update(String(value)).digest('hex');
}

function phoneHash(config, phone) {
  return hmac(config, `phone:${phone}`);
}

function codeHash(config, challengeId, code) {
  return hmac(config, `otp:${challengeId}:${String(code || '').trim()}`);
}

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashesMatch(left, right) {
  const first = Buffer.from(String(left || ''));
  const second = Buffer.from(String(right || ''));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

module.exports = {
  codeHash,
  generateCode,
  hashesMatch,
  hmac,
  phoneHash,
};
