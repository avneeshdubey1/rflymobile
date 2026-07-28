const lastMessages = new Map();

function providerToChannel(provider) {
  const normalized = String(provider || 'disabled').trim().toLowerCase();
  if (normalized === 'cli') return 'CLI';
  if (normalized === 'test') return 'TEST';
  return 'DISABLED';
}

async function deliver({ channel, challengeId, purpose, recipientLast4, code, expiresAt }) {
  if (channel === 'CLI') {
    const expires = expiresAt instanceof Date ? expiresAt.toISOString() : String(expiresAt);
    // Local development adapter only. Do not enable in production.
    console.info(`[OTP CLI] ${purpose} challenge=${challengeId} recipient=*${recipientLast4 || '----'} code=${code} expires=${expires}`);
    return { status: 'MOCKED', providerReference: 'local-cli' };
  }
  if (channel === 'TEST') {
    lastMessages.set(challengeId, { challengeId, purpose, recipientLast4, code, expiresAt });
    return { status: 'MOCKED', providerReference: 'test-memory' };
  }
  return { status: 'DISABLED', providerReference: 'delivery-disabled' };
}

function getLastMessageForTests(challengeId) {
  return lastMessages.get(challengeId);
}

function clearLastMessagesForTests() {
  lastMessages.clear();
}

module.exports = {
  clearLastMessagesForTests,
  deliver,
  getLastMessageForTests,
  providerToChannel,
};
