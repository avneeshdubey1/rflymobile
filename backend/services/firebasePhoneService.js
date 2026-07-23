const crypto = require('crypto');
const admin = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { normalizePhone } = require('./identityService');

function phoneAuthError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateFirebasePhoneClaims(decodedToken, { maxAuthAgeMs, now = Date.now() } = {}) {
  if (decodedToken?.firebase?.sign_in_provider !== 'phone') {
    throw phoneAuthError('The Firebase credential was not created by phone authentication');
  }
  if (!decodedToken.phone_number) {
    throw phoneAuthError('The verified Firebase account has no phone number', 400);
  }
  if (Number.isFinite(maxAuthAgeMs)) {
    const authenticatedAtMs = Number(decodedToken.auth_time) * 1000;
    const ageMs = now - authenticatedAtMs;
    if (!Number.isFinite(authenticatedAtMs) || ageMs < -60_000 || ageMs > maxAuthAgeMs) {
      throw phoneAuthError('Recent phone verification is required');
    }
  }
  return normalizePhone(decodedToken.phone_number);
}

function firebaseProofHash(idToken) {
  return crypto.createHash('sha256').update(String(idToken)).digest('hex');
}

async function verifyFirebasePhoneToken(idToken, options) {
  if (!idToken) {
    const error = new Error('Missing Firebase ID token');
    error.status = 400;
    throw error;
  }
  if (!admin.getApps().length) {
    const error = new Error('Phone authentication is not configured on the server');
    error.status = 503;
    throw error;
  }
  // checkRevoked=true prevents a disabled/revoked Firebase session from being
  // accepted as a phone proof.
  const decodedToken = await getAuth().verifyIdToken(idToken, true);
  return {
    decodedToken,
    phone: validateFirebasePhoneClaims(decodedToken, options),
  };
}

async function verifiedFirebasePhone(idToken) {
  return (await verifyFirebasePhoneToken(idToken)).phone;
}

async function verifiedFirebasePhoneProof(idToken, { maxAuthAgeMs } = {}) {
  const verified = await verifyFirebasePhoneToken(idToken, { maxAuthAgeMs });
  return {
    phone: verified.phone,
    externalProofHash: firebaseProofHash(idToken),
  };
}

module.exports = {
  firebaseProofHash,
  validateFirebasePhoneClaims,
  verifiedFirebasePhone,
  verifiedFirebasePhoneProof,
};
