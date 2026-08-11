const prisma = require('../lib/prisma');
const auditLogRepository = require('./auditLogRepository');

const COMPANY_POLICY_KEY = 'COMPANY';

const policySelect = {
  id: true,
  singletonKey: true,
  enabled: true,
  searchHorizonDays: true,
  workingDayStartMinutes: true,
  workingDayEndMinutes: true,
  defaultJobDurationMinutes: true,
  turnaroundMinutes: true,
  maxJobsPerUnitPerDay: true,
  maxAcreagePerUnitPerDay: true,
  weatherUnavailableAction: true,
  revision: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
};

function policyError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function serializable(execute, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(execute, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' && attempt < attempts - 1) continue;
      throw error;
    }
  }
  throw policyError('The policy update could not be serialized', 'POLICY_WRITE_CONFLICT');
}

async function findCompanyPolicy(client = prisma) {
  return client.autoAssignmentPolicy.findUnique({
    where: { singletonKey: COMPANY_POLICY_KEY },
    select: policySelect,
  });
}

async function updateCompanyPolicy({ expectedRevision, data, actorId }) {
  return serializable(async (transaction) => {
    const before = await findCompanyPolicy(transaction);
    if (!before) throw policyError('Auto-assignment policy is unavailable', 'POLICY_UNAVAILABLE');
    if (before.revision !== expectedRevision) {
      const error = policyError('Auto-assignment policy was changed by another administrator', 'POLICY_REVISION_CONFLICT');
      error.currentRevision = before.revision;
      throw error;
    }

    const changed = await transaction.autoAssignmentPolicy.updateMany({
      where: { id: before.id, revision: expectedRevision },
      data: {
        ...data,
        updatedByUserId: actorId,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      const current = await findCompanyPolicy(transaction);
      const error = policyError('Auto-assignment policy was changed by another administrator', 'POLICY_REVISION_CONFLICT');
      error.currentRevision = current?.revision;
      throw error;
    }

    const after = await findCompanyPolicy(transaction);
    await auditLogRepository.createWithClient(transaction, {
      entityType: 'AutoAssignmentPolicy',
      entityId: after.id,
      action: 'AUTO_ASSIGNMENT_POLICY_UPDATED',
      actorId,
      beforeState: before,
      afterState: after,
      reason: 'Company auto-assignment policy updated',
    });
    return after;
  });
}

module.exports = {
  COMPANY_POLICY_KEY,
  findCompanyPolicy,
  updateCompanyPolicy,
};
