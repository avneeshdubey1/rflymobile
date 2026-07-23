const test = require('node:test');
const assert = require('node:assert/strict');
const {
  firebaseProofHash,
  validateFirebasePhoneClaims,
} = require('../services/firebasePhoneService');

const now = Date.parse('2026-07-23T08:00:00.000Z');

function claims(overrides = {}) {
  return {
    phone_number: '+91 98765 43210',
    auth_time: Math.floor((now - 30_000) / 1000),
    firebase: { sign_in_provider: 'phone' },
    ...overrides,
  };
}

test('Firebase phone proof requires the phone sign-in provider and recent authentication', () => {
  assert.equal(
    validateFirebasePhoneClaims(claims(), { maxAuthAgeMs: 5 * 60_000, now }),
    '+919876543210',
  );
  assert.throws(
    () => validateFirebasePhoneClaims(claims({ firebase: { sign_in_provider: 'password' } }), { maxAuthAgeMs: 5 * 60_000, now }),
    /phone authentication/,
  );
  assert.throws(
    () => validateFirebasePhoneClaims(claims({ auth_time: Math.floor((now - 6 * 60_000) / 1000) }), { maxAuthAgeMs: 5 * 60_000, now }),
    /Recent phone verification/,
  );
  assert.throws(
    () => validateFirebasePhoneClaims(claims({ auth_time: Math.floor((now + 2 * 60_000) / 1000) }), { maxAuthAgeMs: 5 * 60_000, now }),
    /Recent phone verification/,
  );
});

test('Firebase proof fingerprints are stable, non-plaintext, and token-specific', () => {
  const first = firebaseProofHash('firebase-token-one');
  const replay = firebaseProofHash('firebase-token-one');
  const second = firebaseProofHash('firebase-token-two');
  assert.equal(first, replay);
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /firebase-token/);
});
