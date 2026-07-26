const declinedEnquiryRepository = require('../src/repositories/declinedEnquiryRepository');
const auditLogService = require('./auditLogService');

const DECLINE_REASON = 'OUTSIDE_SERVICE_AREA';
const RETENTION_DAYS = 30;

function expiryFrom(now) {
  return new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

async function create({ contactName, contactPhone, sourceChannel, createdByUserId = null, now = new Date() }) {
  const enquiry = await declinedEnquiryRepository.create({
    contactName,
    contactPhone,
    sourceChannel,
    reason: DECLINE_REASON,
    createdByUserId,
    expiresAt: expiryFrom(now),
  });
  await auditLogService.record({
    entityType: 'DeclinedEnquiry',
    entityId: enquiry.id,
    action: 'SERVICE_AREA_DECLINED',
    actorId: createdByUserId,
    afterState: { sourceChannel, reason: DECLINE_REASON, expiresAt: enquiry.expiresAt },
  });
  return enquiry;
}

async function purgeExpired({ now = new Date() } = {}) {
  const result = await declinedEnquiryRepository.deleteExpired(now);
  if (result.count) {
    await auditLogService.record({
      entityType: 'DeclinedEnquiry',
      entityId: 'system',
      action: 'EXPIRED_PURGED',
      afterState: { purgedCount: result.count },
    });
  }
  return result;
}

module.exports = { DECLINE_REASON, RETENTION_DAYS, create, purgeExpired };
