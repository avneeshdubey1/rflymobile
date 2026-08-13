const prisma = require('../lib/prisma');

async function executeLocked({ installationId, actionId, requestHash, execute }) {
  return prisma.$transaction(async (transaction) => {
    const key = `MobileMutation:${installationId}:${actionId}`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
    const existing = await transaction.mobileMutationReceipt.findUnique({
      where: { installationId_actionId: { installationId, actionId } },
    });
    if (existing) {
      return existing.requestHash === requestHash
        ? { kind: 'REPLAY', receipt: existing }
        : { kind: 'ACTION_ID_REUSED', receipt: existing };
    }
    const result = await execute();
    const receipt = await transaction.mobileMutationReceipt.create({
      data: {
        installationId,
        assignmentId: result.assignmentId,
        actionId,
        operation: result.operation,
        requestHash,
        outcome: result.outcome,
        safeResult: result.safeResult,
      },
    });
    return { kind: 'CREATED', receipt };
  });
}

module.exports = { executeLocked };
