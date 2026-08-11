const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');

// Audit history is retained for a long time. Keep it useful for operational
// state changes without turning it into a second store for private payloads.
// Keys are normalized so casing and separators cannot bypass this boundary.
const privateStateKeys = new Set([
  // Farmer/contact data.
  'farmerphone', 'phone', 'phonenumber', 'mobile', 'mobilenumber',
  'farmeraddress', 'address', 'streetaddress',
  // Exact GPS fields and common aliases.
  'latitude', 'longitude', 'lat', 'lng', 'lon', 'long',
  'lastknownlat', 'lastknownlng', 'gpslat', 'gpslng', 'gpslatitude', 'gpslongitude',
  'coordinate', 'coordinates', 'gpscoordinate', 'gpscoordinates', 'distancefromcenterkm', 'distancekm',
  // Payment destinations/links. Transaction-presence booleans remain safe.
  'paymentlink', 'paymenturl', 'paymenturi', 'upilink', 'upiurl', 'upiuri',
  'checkoutlink', 'checkouturl', 'qrcode', 'qrpayload',
  // Free-form communication content. Counts/statuses remain safe.
  'content', 'message', 'messagecontent', 'chatcontent', 'farmermessage', 'notes',
  // Authentication and provider credentials.
  'password', 'passwordhash', 'newpassword', 'currentpassword', 'credentials',
  'authorization', 'cookie', 'setcookie', 'accesstoken', 'refreshtoken',
  'resettoken', 'resetcode', 'otp', 'apikey', 'secret', 'token',
]);

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPrivateStateKey(key) {
  const normalized = normalizeKey(key);
  return privateStateKeys.has(normalized)
    || normalized.includes('password')
    || normalized.endsWith('apikey')
    || normalized.endsWith('accesstoken')
    || normalized.endsWith('refreshtoken')
    || normalized.endsWith('secret')
    || normalized.includes('latitude')
    || normalized.includes('longitude')
    || normalized.includes('coordinate');
}

function sanitizeAuditReason(value) {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/https?:\/\/[^\s)\]}]+/gi, '[redacted link]')
    .replace(/(?:^|[^\d.-])-?\d{1,2}(?:\.\d+)?\s*[,;]\s*-?\d{1,3}(?:\.\d+)?(?=[^\d.]|$)/g, (match) => `${match.charAt(0).match(/[\d-]/) ? '' : match.charAt(0)}[redacted location]`)
    .replace(/\b((?:farmer\s*)?(?:phone|mobile|contact|address)|password|token|secret|otp|api[ _-]?key)\s*[:=]\s*[^;\n]+/gi, '$1: [redacted]')
    .replace(/(?:^|\s)\+?\d{10,15}(?=\s|[.,;!?)]|$)/g, (match) => `${match.startsWith(' ') ? ' ' : ''}[redacted phone]`);
}

function sanitizeAuditState(value) {
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal instances expose implementation fields (including an own
  // `constructor` function) through Object.entries(). Passing those fields to
  // a Json column makes Prisma reject the entire audit write. Preserve the
  // exact decimal value using Decimal's JSON representation before recursing.
  if (Prisma.Decimal.isDecimal(value)) return value.toJSON();
  if (Array.isArray(value)) return value.map(sanitizeAuditState);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isPrivateStateKey(key))
    .map(([key, item]) => [key, sanitizeAuditState(item)]));
}

function sanitizeRow(row) {
  if (!row) return row;
  return {
    ...row,
    beforeState: sanitizeAuditState(row.beforeState),
    afterState: sanitizeAuditState(row.afterState),
    reason: sanitizeAuditReason(row.reason),
  };
}

function createWithClient(client, data) {
  return client.auditLog.create({
    data: {
      ...data,
      beforeState: sanitizeAuditState(data.beforeState),
      afterState: sanitizeAuditState(data.afterState),
      reason: sanitizeAuditReason(data.reason),
    },
  });
}

async function redactStoredSnapshots() {
  const rows = await prisma.auditLog.findMany({ select: { id: true, beforeState: true, afterState: true, reason: true } });
  let redacted = 0;
  for (const row of rows) {
    const beforeState = sanitizeAuditState(row.beforeState);
    const afterState = sanitizeAuditState(row.afterState);
    const reason = sanitizeAuditReason(row.reason);
    if (JSON.stringify(beforeState) === JSON.stringify(row.beforeState)
      && JSON.stringify(afterState) === JSON.stringify(row.afterState)
      && reason === row.reason) continue;
    await prisma.auditLog.update({ where: { id: row.id }, data: { beforeState, afterState, reason } });
    redacted += 1;
  }
  return { examined: rows.length, redacted };
}

module.exports = {
  create: (data) => createWithClient(prisma, data),
  createWithClient,
  findByEntity: (entityType, entityId) => prisma.auditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'asc' } }).then((rows) => rows.map(sanitizeRow)),
  findTimeline: (leadId, assignmentId, paymentIds = []) => prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Lead', entityId: leadId },
        ...(assignmentId ? [{ entityType: 'Assignment', entityId: assignmentId }] : []),
        ...(paymentIds.length ? [{ entityType: 'PaymentRecord', entityId: { in: paymentIds } }] : []),
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }).then((rows) => rows.map(sanitizeRow)),
  redactStoredSnapshots,
  sanitizeAuditReason,
  sanitizeAuditState,
  deleteAll: () => prisma.auditLog.deleteMany(),
};
