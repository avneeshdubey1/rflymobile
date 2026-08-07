const prisma = require('../lib/prisma');
const normalizedCompatibilityRepository = require('./normalizedCompatibilityRepository');
const { setHistoryActor } = require('./historyActorRepository');

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
  delete: (id) => prisma.lead.delete({ where: { id } }),
  deleteAll: () => prisma.lead.deleteMany(),
};
