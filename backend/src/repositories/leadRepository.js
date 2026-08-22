const prisma = require('../lib/prisma');
const normalizedCompatibilityRepository = require('./normalizedCompatibilityRepository');
const { setHistoryActor } = require('./historyActorRepository');
const { createWithClient, sanitizeAuditState } = require('./auditLogRepository');

const defaultInclude = { matchedCenter: true, assignment: true, customer: true };
const DERIVED_PROFILE_FIELDS = new Set(['acreageDecimal', 'cropId', 'farmLocationId']);
const OPERATIONAL_FIELDS = new Set([
  'status',
  'processedAt',
  'notes',
  'matchedCenterId',
  'distanceFromCenterKm',
]);

function repositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function assertOperationalPayload(data) {
  const unsupported = Object.keys(data).filter((field) => !OPERATIONAL_FIELDS.has(field));
  if (unsupported.length) {
    throw repositoryError(
      'LEAD_PROFILE_UPDATE_REQUIRED',
      `Lead profile fields require the normalized profile update path: ${unsupported.join(', ')}`,
    );
  }
}

function assertProfilePayload(data) {
  const forbidden = Object.keys(data).filter((field) => (
    DERIVED_PROFILE_FIELDS.has(field)
    || field === 'status'
    || field === 'processedAt'
    || field === 'distanceFromCenterKm'
  ));
  if (forbidden.length) {
    throw repositoryError(
      'LEAD_OPERATIONAL_UPDATE_REQUIRED',
      `Lead operational or derived fields cannot be written through the profile path: ${forbidden.join(', ')}`,
    );
  }
}

async function replaceSprayPurposes(transaction, leadId, prepared) {
  if (!prepared.replaceSprayPurposes) return;
  await transaction.leadSprayPurpose.deleteMany({ where: { leadId } });
  if (prepared.sprayPurposes.length) {
    await transaction.leadSprayPurpose.createMany({
      data: prepared.sprayPurposes.map((purpose) => ({ leadId, ...purpose })),
    });
  }
}

async function updateOperational(id, data, options = {}) {
  assertOperationalPayload(data);
  return prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, options.actorId);
    return transaction.lead.update({ where: { id }, data, include: defaultInclude });
  });
}

async function updateProfile(id, data, options = {}) {
  assertProfilePayload(data);
  return prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, options.actorId);
    const current = await transaction.lead.findUnique({ where: { id } });
    if (!current) throw repositoryError('LEAD_NOT_FOUND', 'Lead not found');
    const prepared = await normalizedCompatibilityRepository.prepareLeadProfile(
      transaction,
      current,
      data,
      options,
    );
    await transaction.lead.update({ where: { id }, data: prepared.data });
    await replaceSprayPurposes(transaction, id, prepared);
    return transaction.lead.findUnique({ where: { id }, include: defaultInclude });
  }, { isolationLevel: 'Serializable' });
}

async function cancelUnscheduled(id, { actorId, reason }) {
  const normalizedReason = String(reason || '').trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw repositoryError('CANCELLATION_REASON_REQUIRED', 'A removal reason between 3 and 500 characters is required');
  }
  return prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    const current = await transaction.lead.findUnique({ where: { id }, include: defaultInclude });
    if (!current) throw repositoryError('LEAD_NOT_FOUND', 'Request not found');
    if (current.assignment) {
      throw repositoryError('SCHEDULED_REQUEST_CANNOT_BE_REMOVED', 'A scheduled request must be rescheduled or cancelled through its assignment workflow');
    }
    if (!['NEW', 'MANUAL_CALL_REQUIRED', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING'].includes(current.status)) {
      throw repositoryError('REQUEST_NOT_REMOVABLE', 'Only open, unscheduled requests can be removed');
    }
    const lead = await transaction.lead.update({ where: { id }, data: { status: 'CANCELLED' }, include: defaultInclude });
    await createWithClient(transaction, {
      entityType: 'Lead',
      entityId: lead.id,
      action: 'REQUEST_CANCELLED_BY_OPERATIONS',
      actorId,
      beforeState: sanitizeAuditState({ status: current.status, hadAssignment: false }),
      afterState: sanitizeAuditState({ status: lead.status, hadAssignment: false }),
      reason: normalizedReason,
    });
    return lead;
  }, { isolationLevel: 'Serializable' });
}

module.exports = {
  create: (data, options = {}) => prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, options.actorId);
    const prepared = await normalizedCompatibilityRepository.prepareLead(transaction, data, options);
    const lead = await transaction.lead.create({ data: prepared.data });
    await replaceSprayPurposes(transaction, lead.id, prepared);
    return transaction.lead.findUnique({ where: { id: lead.id }, include: defaultInclude });
  }, { isolationLevel: 'Serializable' }),
  findAll: (where = {}) => prisma.lead.findMany({ where, include: defaultInclude, orderBy: { createdAt: 'desc' } }),
  findById: (id) => prisma.lead.findUnique({ where: { id }, include: defaultInclude }),
  update: updateOperational,
  updateOperational,
  updateProfile,
  cancelUnscheduled,
  delete: (id) => prisma.lead.delete({ where: { id } }),
  deleteAll: () => prisma.lead.deleteMany(),
};
