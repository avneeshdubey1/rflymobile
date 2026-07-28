const phoneVerificationRepository = require('../src/repositories/phoneVerificationRepository');
const otpDeliveryAdapter = require('./otpDeliveryAdapter');

async function processOutboxItem(outbox) {
  const challenge = outbox.challenge;
  if (!challenge || challenge.revokedAt || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    await phoneVerificationRepository.markOutboxAttempted(outbox.id, { status: 'DEAD_LETTER' });
    return { status: 'DEAD_LETTER' };
  }
  try {
    const result = await otpDeliveryAdapter.deliver({
      channel: outbox.channel,
      challengeId: challenge.id,
      purpose: challenge.purpose,
      recipientLast4: challenge.recipientLast4,
      code: outbox.plainCode,
      expiresAt: challenge.expiresAt,
    });
    const status = result?.status || 'FAILED';
    await phoneVerificationRepository.markOutboxAttempted(outbox.id, {
      status,
      lastError: status === 'FAILED' ? 'DELIVERY_FAILED' : null,
    });
    await phoneVerificationRepository.recordDeliveryAttempt({
      challengeId: challenge.id,
      channel: outbox.channel,
      status,
      providerReference: result?.providerReference || null,
      failureReason: status === 'FAILED' ? 'DELIVERY_FAILED' : null,
    });
    return { status };
  } catch (error) {
    await phoneVerificationRepository.markOutboxAttempted(outbox.id, {
      status: 'FAILED',
      lastError: error.name || 'DELIVERY_ERROR',
    });
    await phoneVerificationRepository.recordDeliveryAttempt({
      challengeId: challenge.id,
      channel: outbox.channel,
      status: 'FAILED',
      failureReason: error.name || 'DELIVERY_ERROR',
    });
    return { status: 'FAILED' };
  }
}

async function processOne(outbox, plainCode) {
  return processOutboxItem({ ...outbox, plainCode });
}

async function processPending({ take = 25 } = {}) {
  const due = await phoneVerificationRepository.findDueOutbox(new Date(), take);
  const results = [];
  for (const item of due) results.push(await processOutboxItem(item));
  return results;
}

module.exports = {
  processOne,
  processPending,
};
