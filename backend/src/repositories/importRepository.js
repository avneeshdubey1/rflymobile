const prisma = require('../lib/prisma');
const { setHistoryActor } = require('./historyActorRepository');
const normalizedCompatibilityRepository = require('./normalizedCompatibilityRepository');
const crypto = require('node:crypto');

const SERIALIZABLE_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 10_000,
  timeout: 120_000,
};

const sourceRecordSafeSelect = {
  id: true,
  batchId: true,
  sourceSystem: true,
  sheetName: true,
  sourceRowNumber: true,
  externalRecordId: true,
  rowFingerprint: true,
  status: true,
  reasonCode: true,
  safeDetails: true,
  proposedOutcome: true,
  finalOutcome: true,
  encryptionKeyVersion: true,
  payloadExpiresAt: true,
  customerId: true,
  resultEntityType: true,
  resultEntityId: true,
  committedAt: true,
  createdAt: true,
  updatedAt: true,
};

const batchSafeSelect = {
  id: true,
  attemptNumber: true,
  supersedesBatchId: true,
  sourceType: true,
  workbookType: true,
  fileChecksum: true,
  mappingVersion: true,
  dryRunPlanHash: true,
  referenceDataFingerprint: true,
  approvalReference: true,
  backupEvidenceReference: true,
  expectedDeploymentName: true,
  reconciliationChecksum: true,
  status: true,
  totalRows: true,
  validRows: true,
  rejectedRows: true,
  reviewRows: true,
  importedRows: true,
  skippedRows: true,
  safeReport: true,
  rawRetentionUntil: true,
  createdByUserId: true,
  approvedByUserId: true,
  approvedAt: true,
  importStartedAt: true,
  completedAt: true,
  reconciledAt: true,
  rolledBackAt: true,
  failureCode: true,
  createdAt: true,
  updatedAt: true,
};

function repositoryError(message, code, status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function safeReasonCode(value, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_:-]{0,79}$/.test(normalized) ? normalized : fallback;
}

function statusCounts(records) {
  const counts = {
    totalRows: records.length,
    validRows: 0,
    rejectedRows: 0,
    reviewRows: 0,
    importedRows: 0,
    skippedRows: 0,
  };
  for (const record of records) {
    const plannedStatus = record.status === 'VALID'
      && typeof record.proposedOutcome === 'string'
      && record.proposedOutcome.startsWith('SKIP_')
      ? 'SKIPPED'
      : record.status;
    if (plannedStatus === 'VALID') counts.validRows += 1;
    if (record.status === 'REJECTED') counts.rejectedRows += 1;
    if (record.status === 'REVIEW_REQUIRED') counts.reviewRows += 1;
    if (record.status === 'IMPORTED') counts.importedRows += 1;
    if (plannedStatus === 'SKIPPED') counts.skippedRows += 1;
  }
  return counts;
}

function assertPreparedRecordStates(records) {
  const allowedPreparedStatuses = new Set(['VALID', 'REJECTED', 'REVIEW_REQUIRED', 'SKIPPED']);
  if (records.some((record) => !allowedPreparedStatuses.has(record.status))) {
    throw repositoryError('Prepared source records contain an invalid state', 'IMPORT_PREPARE_STATE_INVALID', 400);
  }
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function reconciliationRows(records) {
  return records.map((record) => {
    if (record.status === 'SKIPPED') {
      return {
        sourceRecordId: record.id,
        finalOutcome: record.finalOutcome,
        ...(record.customerId && record.resultEntityType && record.resultEntityId ? {
          customerId: record.customerId,
          entityType: record.resultEntityType,
          entityId: record.resultEntityId,
        } : {}),
      };
    }
    return {
      sourceRecordId: record.id,
      customerId: record.customerId,
      entityType: record.resultEntityType,
      entityId: record.resultEntityId,
    };
  });
}

function reconciliationChecksum(records) {
  return sha256(reconciliationRows(records));
}

async function serializable(work, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(work, SERIALIZABLE_OPTIONS);
    } catch (error) {
      if (error.code === 'P2034' && attempt < attempts - 1) continue;
      throw error;
    }
  }
  throw repositoryError('Import transaction could not be serialized', 'IMPORT_SERIALIZATION_FAILED', 503);
}

async function lockBatch(transaction, batchId, includePayloads = false) {
  const rows = await transaction.$queryRaw`
    SELECT id
    FROM "ImportBatch"
    WHERE id = ${batchId}
    FOR UPDATE
  `;
  if (!rows.length) throw repositoryError('Import batch not found', 'IMPORT_BATCH_NOT_FOUND', 404);

  return transaction.importBatch.findUnique({
    where: { id: batchId },
    ...(includePayloads
      ? { include: { sourceRecords: { orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }] } } }
      : {}),
  });
}

async function requireActiveUser(transaction, userId, { admin = false } = {}) {
  if (!userId) throw repositoryError('An active operator is required', 'IMPORT_OPERATOR_REQUIRED', 403);
  const user = await transaction.user.findFirst({
    where: {
      id: userId,
      active: true,
      archivedAt: null,
      ...(admin ? { role: 'ADMIN' } : {}),
    },
    select: { id: true, role: true },
  });
  if (!user) {
    throw repositoryError(
      admin ? 'An active Admin approval is required' : 'An active operator is required',
      admin ? 'IMPORT_ACTIVE_ADMIN_REQUIRED' : 'IMPORT_ACTIVE_OPERATOR_REQUIRED',
      403,
    );
  }
  return user;
}

function requireBatchOperator(user, batch) {
  if (user.role !== 'ADMIN' && batch.createdByUserId !== user.id) {
    throw repositoryError('Only the batch creator or an Admin may modify this import', 'IMPORT_BATCH_OPERATOR_FORBIDDEN', 403);
  }
}

function auditData({ batchId, action, actorId = null, beforeState = null, afterState = null, reason = null }) {
  return {
    entityType: 'ImportBatch',
    entityId: batchId,
    action,
    actorId,
    beforeState,
    afterState,
    reason,
  };
}

async function readReferenceData(transaction) {
  const [crops, locations, operatingCenters, employees, languages] = await Promise.all([
      transaction.crop.findMany({
        where: { active: true },
        select: {
          id: true,
          code: true,
          displayName: true,
          normalizedName: true,
          active: true,
          updatedAt: true,
        },
        orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      }),
      transaction.location.findMany({
        where: { active: true },
        select: {
          id: true,
          countryCode: true,
          state: true,
          district: true,
          mandal: true,
          village: true,
          postalCode: true,
          normalizedKey: true,
          active: true,
          updatedAt: true,
        },
        orderBy: [{ normalizedKey: 'asc' }, { id: 'asc' }],
      }),
      transaction.operatingCenter.findMany({
        where: { active: true },
        select: {
          id: true,
          code: true,
          name: true,
          administrativeLocationId: true,
          active: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      transaction.user.findMany({
        where: { active: true, archivedAt: null, employeeCode: { not: null } },
        select: { id: true, employeeCode: true, active: true },
        orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
      }),
      transaction.language.findMany({
        where: { active: true },
        select: { id: true, code: true, displayName: true, active: true, updatedAt: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
  ]);
  return { crops, locations, operatingCenters, employees, languages };
}

async function getReferenceData(transaction = null) {
  if (transaction) return readReferenceData(transaction);
  return prisma.$transaction(readReferenceData, { isolationLevel: 'RepeatableRead' });
}

async function findCustomersByPhones(phones, transaction = prisma) {
  const uniquePhones = [...new Set((phones || []).filter(Boolean))];
  if (!uniquePhones.length) return [];
  return transaction.customer.findMany({
    where: { phone: { in: uniquePhones } },
    select: {
      id: true,
      displayName: true,
      phone: true,
      active: true,
      createdByImportBatchId: true,
    },
    orderBy: { id: 'asc' },
  });
}

const priorSourceRecordSelect = {
  id: true,
  batchId: true,
  sourceSystem: true,
  externalRecordId: true,
  rowFingerprint: true,
  phoneFingerprint: true,
  status: true,
  customerId: true,
  resultEntityType: true,
  resultEntityId: true,
  committedAt: true,
  createdAt: true,
};

async function findPriorImportedSourceRecords(candidates, { excludeBatchId = null } = {}, transaction = prisma) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const externalIdsBySystem = new Map();
  const fingerprints = new Set();
  for (const candidate of rows) {
    if (candidate?.externalRecordId && candidate?.sourceSystem) {
      const values = externalIdsBySystem.get(candidate.sourceSystem) || new Set();
      values.add(candidate.externalRecordId);
      externalIdsBySystem.set(candidate.sourceSystem, values);
    } else if (candidate?.rowFingerprint) {
      fingerprints.add(candidate.rowFingerprint);
    }
  }

  const found = new Map();
  const baseWhere = {
    status: 'IMPORTED',
    ...(excludeBatchId ? { batchId: { not: excludeBatchId } } : {}),
  };
  for (const [sourceSystem, values] of externalIdsBySystem) {
    const ids = [...values];
    for (let offset = 0; offset < ids.length; offset += 500) {
      const matches = await transaction.sourceRecord.findMany({
        where: {
          ...baseWhere,
          sourceSystem,
          externalRecordId: { in: ids.slice(offset, offset + 500) },
        },
        select: priorSourceRecordSelect,
        orderBy: [{ committedAt: 'asc' }, { id: 'asc' }],
      });
      for (const match of matches) found.set(match.id, match);
    }
  }
  const fingerprintValues = [...fingerprints];
  for (let offset = 0; offset < fingerprintValues.length; offset += 500) {
    const matches = await transaction.sourceRecord.findMany({
      where: {
        ...baseWhere,
        rowFingerprint: { in: fingerprintValues.slice(offset, offset + 500) },
      },
      select: priorSourceRecordSelect,
      orderBy: [{ committedAt: 'asc' }, { id: 'asc' }],
    });
    for (const match of matches) found.set(match.id, match);
  }
  return [...found.values()];
}

function normalizeChecksumMapping(checksumOrArgs, maybeMappingVersion) {
  if (checksumOrArgs && typeof checksumOrArgs === 'object') {
    return {
      fileChecksum: checksumOrArgs.fileChecksum,
      mappingVersion: checksumOrArgs.mappingVersion,
    };
  }
  return { fileChecksum: checksumOrArgs, mappingVersion: maybeMappingVersion };
}

async function findBatchByChecksumMapping(checksumOrArgs, maybeMappingVersion) {
  const { fileChecksum, mappingVersion } = normalizeChecksumMapping(checksumOrArgs, maybeMappingVersion);
  return prisma.importBatch.findFirst({
    where: { fileChecksum, mappingVersion },
    orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
    select: batchSafeSelect,
  });
}

async function createPreparedBatch(batchOrArgs, maybeRecords) {
  const batch = batchOrArgs?.batch || batchOrArgs;
  const records = batchOrArgs?.batch ? batchOrArgs.records : maybeRecords;
  if (!batch || !Array.isArray(records)) {
    throw repositoryError('Batch data and source records are required', 'IMPORT_PREPARE_DATA_REQUIRED', 400);
  }
  if (batch.attemptNumber !== 1 || batch.supersedesBatchId) {
    throw repositoryError('An initial import must begin with attempt one', 'IMPORT_INITIAL_ATTEMPT_INVALID', 400);
  }
  assertPreparedRecordStates(records);
  const counts = statusCounts(records);
  const expectedBatchStatus = counts.rejectedRows || counts.reviewRows
    ? 'REVIEW_REQUIRED'
    : 'VALIDATED';
  if (batch.status !== expectedBatchStatus) {
    throw repositoryError('Batch status does not match its prepared rows', 'IMPORT_PREPARE_STATUS_MISMATCH', 400);
  }
  const batchData = { ...batch, ...counts };

  return serializable(async (transaction) => {
    await requireActiveUser(transaction, batch.createdByUserId);
    const created = await transaction.importBatch.create({ data: batchData });
    if (records.length) {
      // Keep each INSERT comfortably below PostgreSQL's bind-parameter limit
      // while retaining one all-or-nothing transaction for the whole batch.
      for (let offset = 0; offset < records.length; offset += 250) {
        await transaction.sourceRecord.createMany({
          data: records
            .slice(offset, offset + 250)
            .map((record) => ({ ...record, batchId: created.id })),
        });
      }
    }
    await transaction.auditLog.create({
      data: auditData({
        batchId: created.id,
        action: 'IMPORT_BATCH_PREPARED',
        actorId: created.createdByUserId,
        afterState: {
          status: created.status,
          sourceType: created.sourceType,
          mappingVersion: created.mappingVersion,
          ...counts,
        },
        reason: 'WORKBOOK_PREFLIGHT_AND_DRY_RUN_COMPLETE',
      }),
    });
    return transaction.importBatch.findUnique({ where: { id: created.id }, select: batchSafeSelect });
  });
}

async function createSupersedingPreparedBatch({
  priorBatchId,
  batch,
  records,
  actorId = null,
  confirmation = null,
}) {
  if (!priorBatchId || !batch?.id || priorBatchId === batch.id || !Array.isArray(records)) {
    throw repositoryError('Batch data and source records are required', 'IMPORT_PREPARE_DATA_REQUIRED', 400);
  }
  assertPreparedRecordStates(records);
  const counts = statusCounts(records);
  const expectedBatchStatus = counts.rejectedRows || counts.reviewRows ? 'REVIEW_REQUIRED' : 'VALIDATED';
  if (batch.status !== expectedBatchStatus) {
    throw repositoryError('Batch status does not match its prepared rows', 'IMPORT_PREPARE_STATUS_MISMATCH', 400);
  }
  if (confirmation !== `REPREPARE_IMPORT_${priorBatchId}`) {
    throw repositoryError('Exact re-prepare confirmation is required', 'IMPORT_REPREPARE_CONFIRMATION_INVALID', 400);
  }
  return serializable(async (transaction) => {
    const operator = await requireActiveUser(transaction, actorId);
    const existing = await lockBatch(transaction, priorBatchId, true);
    requireBatchOperator(operator, existing);
    if (!['STAGED', 'VALIDATED', 'REVIEW_REQUIRED', 'FAILED', 'ROLLED_BACK'].includes(existing.status)) {
      throw repositoryError('This import cannot be re-prepared in its current state', 'IMPORT_REPREPARE_NOT_ALLOWED');
    }
    if (existing.fileChecksum !== batch.fileChecksum || existing.mappingVersion !== batch.mappingVersion) {
      throw repositoryError('Re-prepare identity does not match the original batch', 'IMPORT_REPREPARE_IDENTITY_MISMATCH');
    }
    const [historicalServices, villageVisits, createdCustomers] = await Promise.all([
      transaction.historicalServiceRecord.count({ where: { sourceRecord: { batchId: priorBatchId } } }),
      transaction.villageVisit.count({ where: { sourceRecord: { batchId: priorBatchId } } }),
      transaction.customer.count({ where: { createdByImportBatchId: priorBatchId } }),
    ]);
    if (historicalServices || villageVisits || createdCustomers
      || existing.sourceRecords.some((record) => record.resultEntityId || record.customerId || record.committedAt)) {
      throw repositoryError('Canonical results block a new import attempt', 'IMPORT_REPREPARE_CANONICAL_DATA_EXISTS');
    }
    const latest = await transaction.importBatch.findFirst({
      where: { fileChecksum: existing.fileChecksum, mappingVersion: existing.mappingVersion },
      orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, attemptNumber: true },
    });
    if (!latest || latest.id !== existing.id) {
      throw repositoryError('A newer import attempt already exists', 'IMPORT_REPREPARE_STALE_ATTEMPT');
    }

    const attemptNumber = existing.attemptNumber + 1;
    const {
      id: newBatchId,
      attemptNumber: _ignoredAttemptNumber,
      supersedesBatchId: _ignoredSupersedesBatchId,
      ...provided
    } = batch;
    await transaction.importBatch.update({
      where: { id: existing.id },
      data: {
        status: 'SUPERSEDED',
      },
    });
    const created = await transaction.importBatch.create({
      data: {
        ...provided,
        id: newBatchId,
        attemptNumber,
        supersedesBatchId: existing.id,
        ...counts,
        status: expectedBatchStatus,
        importedRows: 0,
        createdByUserId: actorId,
      },
    });
    for (let offset = 0; offset < records.length; offset += 250) {
      await transaction.sourceRecord.createMany({
        data: records.slice(offset, offset + 250).map((record) => ({ ...record, batchId: created.id })),
      });
    }
    await transaction.auditLog.createMany({
      data: [
        auditData({
          batchId: existing.id,
          action: 'IMPORT_BATCH_SUPERSEDED',
          actorId,
          beforeState: {
            batchId: existing.id,
            attemptNumber: existing.attemptNumber,
            status: existing.status,
            dryRunPlanHash: existing.dryRunPlanHash,
            referenceDataFingerprint: existing.referenceDataFingerprint,
            totalRows: existing.totalRows,
            validRows: existing.validRows,
            rejectedRows: existing.rejectedRows,
            reviewRows: existing.reviewRows,
            skippedRows: existing.skippedRows,
          },
          afterState: {
            status: 'SUPERSEDED',
            supersededByBatchId: created.id,
            supersededByAttemptNumber: created.attemptNumber,
            successorDryRunPlanHash: created.dryRunPlanHash,
            successorReferenceDataFingerprint: created.referenceDataFingerprint,
          },
          reason: 'IMMUTABLE_IMPORT_ATTEMPT_SUPERSEDED',
        }),
        auditData({
          batchId: created.id,
          action: 'IMPORT_BATCH_PREPARED_AS_NEW_ATTEMPT',
          actorId,
          beforeState: {
            supersedesBatchId: existing.id,
            supersedesAttemptNumber: existing.attemptNumber,
            priorDryRunPlanHash: existing.dryRunPlanHash,
            priorReferenceDataFingerprint: existing.referenceDataFingerprint,
          },
          afterState: {
            batchId: created.id,
            attemptNumber: created.attemptNumber,
            status: created.status,
            dryRunPlanHash: created.dryRunPlanHash,
            referenceDataFingerprint: created.referenceDataFingerprint,
            ...counts,
          },
          reason: 'LOCKED_NEW_IMPORT_ATTEMPT_CREATED',
        }),
      ],
    });
    return transaction.importBatch.findUnique({ where: { id: created.id }, select: batchSafeSelect });
  });
}

async function getBatchWithSafeRecords(batchId) {
  return prisma.importBatch.findUnique({
    where: { id: batchId },
    select: {
      ...batchSafeSelect,
      sourceRecords: {
        select: sourceRecordSafeSelect,
        orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
      },
    },
  });
}

async function getBatchWithPayloadRecords(batchId) {
  return prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      sourceRecords: {
        orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
      },
    },
  });
}

async function approveBatch({
  batchId,
  adminUserId,
  adminId,
  approvalReference,
  backupEvidenceReference,
  expectedDeploymentName,
  expectedPlanHash,
  expectedReferenceDataFingerprint,
  validate,
}) {
  const approvingAdminId = adminUserId || adminId;
  return serializable(async (transaction) => {
    await requireActiveUser(transaction, approvingAdminId, { admin: true });
    const batch = await lockBatch(transaction, batchId, true);

    if (batch.status === 'APPROVED' && batch.approvedByUserId === approvingAdminId) {
      return transaction.importBatch.findUnique({ where: { id: batchId }, select: batchSafeSelect });
    }
    if (batch.status !== 'VALIDATED') {
      throw repositoryError('Only a fully validated import can be approved', 'IMPORT_NOT_VALIDATED');
    }
    if (batch.rejectedRows !== 0 || batch.reviewRows !== 0) {
      throw repositoryError('Rejected or review-required rows block approval', 'IMPORT_UNRESOLVED_ROWS');
    }
    if (expectedPlanHash && batch.dryRunPlanHash !== expectedPlanHash) {
      throw repositoryError('Dry-run plan changed before approval', 'IMPORT_PLAN_DRIFT');
    }
    if (expectedReferenceDataFingerprint
      && batch.referenceDataFingerprint !== expectedReferenceDataFingerprint) {
      throw repositoryError('Reference data changed before approval', 'IMPORT_REFERENCE_DRIFT');
    }
    if (validate) await validate(transaction, batch, commitActions(transaction));

    const updated = await transaction.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'APPROVED',
        approvedByUserId: approvingAdminId,
        approvedAt: new Date(),
        approvalReference,
        backupEvidenceReference,
        expectedDeploymentName,
        failureCode: null,
      },
      select: batchSafeSelect,
    });
    await transaction.auditLog.create({
      data: auditData({
        batchId,
        action: 'IMPORT_BATCH_APPROVED',
        actorId: approvingAdminId,
        beforeState: { status: batch.status },
        afterState: {
          status: updated.status,
          totalRows: updated.totalRows,
          validRows: updated.validRows,
          rejectedRows: updated.rejectedRows,
          reviewRows: updated.reviewRows,
          hasApprovalReference: Boolean(updated.approvalReference),
          hasBackupEvidence: Boolean(updated.backupEvidenceReference),
          hasExpectedDeployment: Boolean(updated.expectedDeploymentName),
        },
        reason: 'ACTIVE_ADMIN_APPROVAL',
      }),
    });
    return updated;
  });
}

function commitActions(transaction) {
  return {
    getReferenceData: () => getReferenceData(transaction),
    findCustomersByPhones: (phones) => findCustomersByPhones(phones, transaction),
    findPriorImportedSourceRecords: (candidates, options) => findPriorImportedSourceRecords(candidates, options, transaction),
    findCustomerByPhone: (phone) => transaction.customer.findUnique({ where: { phone }, select: { id: true, phone: true } }),
    createCustomer: async (data) => {
      const customer = await transaction.customer.create({ data });
      await normalizedCompatibilityRepository.syncCustomer(transaction, customer);
      return { id: customer.id, phone: customer.phone };
    },
    createHistoricalService: (data) => transaction.historicalServiceRecord.create({ data, select: { id: true } }),
    createVillageVisit: (data) => transaction.villageVisit.create({ data, select: { id: true } }),
    updateSourceRecord: (id, data) => transaction.sourceRecord.update({ where: { id }, data }),
    updateSourceRecords: (where, data) => transaction.sourceRecord.updateMany({ where, data }),
  };
}

async function commitBatch({
  batchId,
  actorId,
  expectedPlanHash,
  expectedReferenceDataFingerprint,
  actualDeploymentName,
  execute,
}) {
  if (typeof execute !== 'function') {
    throw repositoryError('A canonical import transaction callback is required', 'IMPORT_COMMIT_CALLBACK_REQUIRED', 500);
  }

  let commitCallbackStarted = false;
  try {
    return await serializable(async (transaction) => {
    await requireActiveUser(transaction, actorId, { admin: true });
    await setHistoryActor(transaction, actorId);
    const batch = await lockBatch(transaction, batchId, true);
    if (batch.status === 'COMPLETED') {
      return Object.assign(
        await transaction.importBatch.findUnique({ where: { id: batchId }, select: batchSafeSelect }),
        {
          alreadyCompleted: true,
          commitResult: null,
        },
      );
    }
    if (batch.status !== 'APPROVED') {
      throw repositoryError('Only an approved import can be committed', 'IMPORT_NOT_APPROVED');
    }
    if (batch.approvedByUserId !== actorId) {
      throw repositoryError('The approving Admin must perform this commit', 'IMPORT_APPROVER_MISMATCH', 403);
    }
    if (expectedPlanHash && batch.dryRunPlanHash !== expectedPlanHash) {
      throw repositoryError('Dry-run plan changed before commit', 'IMPORT_PLAN_DRIFT');
    }
    if (expectedReferenceDataFingerprint
      && batch.referenceDataFingerprint !== expectedReferenceDataFingerprint) {
      throw repositoryError('Reference data changed before commit', 'IMPORT_REFERENCE_DRIFT');
    }
    if (batch.expectedDeploymentName
      && batch.expectedDeploymentName !== actualDeploymentName) {
      throw repositoryError('Deployment identity does not match the approved import', 'IMPORT_DEPLOYMENT_MISMATCH');
    }

    const importStartedAt = new Date();
    await transaction.importBatch.update({
      where: { id: batchId },
      data: { status: 'IMPORTING', importStartedAt, failureCode: null },
    });

    const [userCountBefore, leadCountBefore] = await Promise.all([
      transaction.user.count(),
      transaction.lead.count(),
    ]);

    // The callback runs inside this serializable, row-locked transaction. The
    // scoped actions keep canonical writes in this repository, while the raw
    // transaction remains available for exceptional importer needs.
    const actions = commitActions(transaction);
    commitCallbackStarted = true;
    const result = await execute(transaction, batch, actions);

    const currentImportedRecords = await transaction.sourceRecord.findMany({
      where: { batchId, status: 'IMPORTED' },
      select: priorSourceRecordSelect,
    });
    const duplicateOutcomes = await findPriorImportedSourceRecords(
      currentImportedRecords,
      { excludeBatchId: batchId },
      transaction,
    );
    if (duplicateOutcomes.length) {
      throw repositoryError(
        'A source outcome was committed by another import attempt',
        'IMPORT_SOURCE_OUTCOME_CONFLICT',
      );
    }

    const [userCountAfter, leadCountAfter] = await Promise.all([
      transaction.user.count(),
      transaction.lead.count(),
    ]);
    if (userCountAfter !== userCountBefore || leadCountAfter !== leadCountBefore) {
      throw repositoryError(
        'Farmer workbook import cannot create User or Lead records',
        'IMPORT_FORBIDDEN_ENTITY_WRITE',
      );
    }

    const [grouped, committedRecords] = await Promise.all([
      transaction.sourceRecord.groupBy({
        by: ['status'],
        where: { batchId },
        _count: { _all: true },
      }),
      transaction.sourceRecord.findMany({
        where: { batchId },
        select: {
          id: true,
          sourceSystem: true,
          sourceRowNumber: true,
          sheetName: true,
          status: true,
          proposedOutcome: true,
          finalOutcome: true,
          customerId: true,
          resultEntityType: true,
          resultEntityId: true,
        },
        orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
      }),
    ]);
    const countsByStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const importedRows = countsByStatus.IMPORTED || 0;
    const skippedRows = countsByStatus.SKIPPED || 0;
    const unresolvedRows = (countsByStatus.VALID || 0)
      + (countsByStatus.PENDING || 0)
      + (countsByStatus.REJECTED || 0)
      + (countsByStatus.REVIEW_REQUIRED || 0);
    if (unresolvedRows !== 0) {
      throw repositoryError('Commit callback left unresolved source records', 'IMPORT_COMMIT_INCOMPLETE');
    }
    if (importedRows !== batch.validRows || skippedRows !== batch.skippedRows) {
      throw repositoryError('Committed row counts differ from the approved plan', 'IMPORT_COMMIT_COUNT_DRIFT');
    }
    if (committedRecords.some((record) => record.status === 'IMPORTED' && (
      (record.sourceSystem === 'ZOHO_CRM' && record.resultEntityType !== 'HistoricalServiceRecord')
      || (record.sourceSystem === 'GOOGLE_FORMS' && record.resultEntityType !== 'VillageVisit')
    ))) {
      throw repositoryError('A source row was committed to the wrong canonical entity type', 'IMPORT_SOURCE_OUTCOME_MISMATCH');
    }
    const [incompleteImportedRows, historicalServices, villageVisits] = await Promise.all([
      transaction.sourceRecord.count({
        where: {
          batchId,
          status: 'IMPORTED',
          OR: [
            { customerId: null },
            { resultEntityType: null },
            { resultEntityId: null },
            { committedAt: null },
          ],
        },
      }),
      transaction.historicalServiceRecord.count({ where: { sourceRecord: { batchId } } }),
      transaction.villageVisit.count({ where: { sourceRecord: { batchId } } }),
    ]);
    if (incompleteImportedRows !== 0 || historicalServices + villageVisits !== importedRows) {
      throw repositoryError('Canonical import reconciliation failed', 'IMPORT_CANONICAL_RECONCILIATION_FAILED');
    }

    const computedReconciliationChecksum = reconciliationChecksum(committedRecords);
    if (result?.reconciliationChecksum && result.reconciliationChecksum !== computedReconciliationChecksum) {
      throw repositoryError('Commit reconciliation checksum does not match canonical results', 'IMPORT_RECONCILIATION_CHECKSUM_MISMATCH');
    }
    const completedAt = new Date();
    const finalSafeReport = {
      ...(batch.safeReport && typeof batch.safeReport === 'object' ? batch.safeReport : {}),
      status: 'COMPLETED',
      finalOutcomes: { importedRows, skippedRows },
    };
    const updated = await transaction.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        importedRows,
        skippedRows,
        completedAt,
        reconciledAt: result?.reconciledAt || completedAt,
        reconciliationChecksum: computedReconciliationChecksum,
        safeReport: result?.safeReport || finalSafeReport,
      },
      select: batchSafeSelect,
    });
    await transaction.auditLog.create({
      data: auditData({
        batchId,
        action: 'IMPORT_BATCH_COMMITTED',
        actorId,
        beforeState: { status: batch.status },
        afterState: {
          status: updated.status,
          totalRows: updated.totalRows,
          importedRows: updated.importedRows,
          skippedRows: updated.skippedRows,
          hasReconciliationChecksum: Boolean(updated.reconciliationChecksum),
        },
        reason: 'ATOMIC_CANONICAL_IMPORT_COMPLETE',
      }),
    });
    return Object.assign(updated, { alreadyCompleted: false, commitResult: result });
    });
  } catch (error) {
    if (commitCallbackStarted) {
      const failureCode = safeReasonCode(error?.code, 'IMPORT_COMMIT_CALLBACK_FAILED');
      const errorClass = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u.test(String(error?.name || ''))
        ? String(error.name)
        : 'Error';
      try {
        await prisma.$transaction(async (transaction) => {
          const batch = await transaction.importBatch.findUnique({
            where: { id: batchId },
            select: { id: true, status: true, approvedByUserId: true },
          });
          if (!batch) return;
          await transaction.auditLog.create({
            data: auditData({
              batchId,
              action: 'IMPORT_BATCH_COMMIT_FAILED',
              actorId: batch.approvedByUserId || actorId || null,
              afterState: {
                status: batch.status,
                failureCode,
                errorClass,
                retryable: batch.status === 'APPROVED',
              },
              reason: failureCode,
            }),
          });
        });
      } catch (_auditError) {
        // Never replace the original commit failure with secondary evidence
        // recording failure, and never emit either error into logs here.
      }
    }
    throw error;
  }
}

async function abortBatch({ batchId, actorId, reasonCode = 'OPERATOR_ABORT' }) {
  const safeReason = safeReasonCode(reasonCode, 'OPERATOR_ABORT');
  return serializable(async (transaction) => {
    const operator = await requireActiveUser(transaction, actorId);
    const batch = await lockBatch(transaction, batchId);
    requireBatchOperator(operator, batch);
    if (batch.status === 'ROLLED_BACK') {
      return transaction.importBatch.findUnique({ where: { id: batchId }, select: batchSafeSelect });
    }
    if (!['STAGED', 'VALIDATED', 'REVIEW_REQUIRED', 'APPROVED', 'FAILED'].includes(batch.status)) {
      throw repositoryError('This import attempt cannot be aborted', 'IMPORT_ABORT_NOT_ALLOWED');
    }

    const rolledBackAt = new Date();
    await transaction.sourceRecord.updateMany({
      where: { batchId },
      data: {
        status: 'ROLLED_BACK',
        finalOutcome: 'ABORTED',
      },
    });
    const updated = await transaction.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'ROLLED_BACK',
        rolledBackAt,
        failureCode: safeReason,
      },
      select: batchSafeSelect,
    });
    await transaction.auditLog.create({
      data: auditData({
        batchId,
        action: 'IMPORT_BATCH_ABORTED',
        actorId,
        beforeState: { status: batch.status },
        afterState: { status: updated.status, totalRows: updated.totalRows },
        reason: safeReason,
      }),
    });
    return updated;
  });
}

async function purgeExpiredPayloads({ batchId, actorId } = {}) {
  if (!batchId) throw repositoryError('A named import batch is required', 'IMPORT_PURGE_BATCH_REQUIRED', 400);
  return serializable(async (transaction) => {
    const operator = await requireActiveUser(transaction, actorId);
    const batch = await lockBatch(transaction, batchId);
    requireBatchOperator(operator, batch);
    const [{ now }] = await transaction.$queryRaw`SELECT CURRENT_TIMESTAMP AS now`;
    const pending = await transaction.sourceRecord.findMany({
      where: { batchId, payloadExpiresAt: { lte: now } },
      select: {
        id: true,
        encryptedPayload: true,
        payloadIv: true,
        payloadAuthTag: true,
        phoneFingerprint: true,
        recipientLast4: true,
      },
    });
    const recordIds = pending.filter((record) => record.encryptedPayload.length
      || record.payloadIv.length
      || record.payloadAuthTag.length
      || record.phoneFingerprint
      || record.recipientLast4).map((record) => record.id);
    if (!recordIds.length) return { batchId, purgedRecords: 0, affectedBatches: 0 };
    await transaction.sourceRecord.updateMany({
      where: { id: { in: recordIds }, batchId, payloadExpiresAt: { lte: now } },
      data: {
        encryptedPayload: Buffer.alloc(0),
        payloadIv: Buffer.alloc(0),
        payloadAuthTag: Buffer.alloc(0),
        phoneFingerprint: null,
        recipientLast4: null,
      },
    });
    if (['STAGED', 'VALIDATED', 'REVIEW_REQUIRED', 'APPROVED'].includes(batch.status)) {
      await transaction.importBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED', failureCode: 'STAGED_PAYLOAD_EXPIRED' },
      });
    }
    await transaction.auditLog.create({
      data: auditData({
        batchId,
        action: 'IMPORT_STAGED_PAYLOAD_PURGED',
        actorId,
        afterState: { purgedRecords: recordIds.length },
        reason: 'RAW_RETENTION_EXPIRED',
      }),
    });
    return { batchId, purgedRecords: recordIds.length, affectedBatches: 1 };
  });
}

async function verifyBatch(batchId) {
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.findUnique({ where: { id: batchId }, select: batchSafeSelect });
    if (!batch) throw repositoryError('Import batch not found', 'IMPORT_BATCH_NOT_FOUND', 404);
    const [records, historicalRows, villageRows, createdCustomers] = await Promise.all([
      transaction.sourceRecord.findMany({
        where: { batchId },
        select: {
          id: true,
          sourceSystem: true,
          sheetName: true,
          sourceRowNumber: true,
          status: true,
          proposedOutcome: true,
          finalOutcome: true,
          customerId: true,
          resultEntityType: true,
          resultEntityId: true,
          committedAt: true,
        },
        orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
      }),
      transaction.historicalServiceRecord.findMany({
        where: { sourceRecord: { batchId } },
        select: { id: true, sourceRecordId: true, customerId: true },
      }),
      transaction.villageVisit.findMany({
        where: { sourceRecord: { batchId } },
        select: { id: true, sourceRecordId: true, customerId: true },
      }),
      transaction.customer.count({ where: { createdByImportBatchId: batchId } }),
    ]);

    const sourceRecordStatusCounts = {};
    const sourceSystemCounts = {};
    for (const record of records) {
      sourceRecordStatusCounts[record.status] = (sourceRecordStatusCounts[record.status] || 0) + 1;
      sourceSystemCounts[record.sourceSystem] = (sourceSystemCounts[record.sourceSystem] || 0) + 1;
    }
    const historyBySource = new Map(historicalRows.map((row) => [row.sourceRecordId, row]));
    const visitBySource = new Map(villageRows.map((row) => [row.sourceRecordId, row]));
    const linkedHistoryIds = records
      .filter((record) => record.status === 'SKIPPED'
        && record.finalOutcome === 'SKIPPED_ALREADY_IMPORTED_SOURCE_RECORD'
        && record.resultEntityType === 'HistoricalServiceRecord'
        && record.resultEntityId)
      .map((record) => record.resultEntityId);
    const linkedVisitIds = records
      .filter((record) => record.status === 'SKIPPED'
        && record.finalOutcome === 'SKIPPED_ALREADY_IMPORTED_SOURCE_RECORD'
        && record.resultEntityType === 'VillageVisit'
        && record.resultEntityId)
      .map((record) => record.resultEntityId);
    const [linkedHistories, linkedVisits] = await Promise.all([
      linkedHistoryIds.length
        ? transaction.historicalServiceRecord.findMany({
          where: { id: { in: linkedHistoryIds } },
          select: { id: true, customerId: true },
        })
        : [],
      linkedVisitIds.length
        ? transaction.villageVisit.findMany({
          where: { id: { in: linkedVisitIds } },
          select: { id: true, customerId: true },
        })
        : [],
    ]);
    const linkedHistoryById = new Map(linkedHistories.map((row) => [row.id, row]));
    const linkedVisitById = new Map(linkedVisits.map((row) => [row.id, row]));
    let incompleteImportedRows = 0;
    let unexpectedResults = 0;
    let sourceOutcomeMismatches = 0;
    for (const record of records) {
      const history = historyBySource.get(record.id);
      const visit = visitBySource.get(record.id);
      if (record.status === 'IMPORTED') {
        if (!record.customerId || !record.resultEntityType || !record.resultEntityId || !record.committedAt) {
          incompleteImportedRows += 1;
        }
        const correctHistory = record.sourceSystem === 'ZOHO_CRM'
          && record.resultEntityType === 'HistoricalServiceRecord'
          && history?.id === record.resultEntityId
          && history?.customerId === record.customerId
          && !visit;
        const correctVisit = record.sourceSystem === 'GOOGLE_FORMS'
          && record.resultEntityType === 'VillageVisit'
          && visit?.id === record.resultEntityId
          && visit?.customerId === record.customerId
          && !history;
        if (!correctHistory && !correctVisit) sourceOutcomeMismatches += 1;
      } else if (record.status === 'SKIPPED'
        && record.finalOutcome === 'SKIPPED_ALREADY_IMPORTED_SOURCE_RECORD') {
        const linkedHistory = linkedHistoryById.get(record.resultEntityId);
        const linkedVisit = linkedVisitById.get(record.resultEntityId);
        const correctHistoryLink = record.sourceSystem === 'ZOHO_CRM'
          && record.resultEntityType === 'HistoricalServiceRecord'
          && linkedHistory?.customerId === record.customerId
          && !linkedVisit;
        const correctVisitLink = record.sourceSystem === 'GOOGLE_FORMS'
          && record.resultEntityType === 'VillageVisit'
          && linkedVisit?.customerId === record.customerId
          && !linkedHistory;
        if (!record.customerId || !record.resultEntityId || !record.committedAt
          || (!correctHistoryLink && !correctVisitLink)) {
          sourceOutcomeMismatches += 1;
        }
        if (history || visit) unexpectedResults += 1;
      } else {
        const committedSkip = batch.status === 'COMPLETED'
          && record.status === 'SKIPPED'
          && record.finalOutcome === 'SKIPPED_EMPTY_ROW'
          && Boolean(record.committedAt);
        if (record.customerId || record.resultEntityType || record.resultEntityId || history || visit
          || (record.committedAt && !committedSkip)) unexpectedResults += 1;
      }
    }

    const sourceRows = records.length;
    const importedRows = sourceRecordStatusCounts.IMPORTED || 0;
    const skippedRows = sourceRecordStatusCounts.SKIPPED || 0;
    const historicalServices = historicalRows.length;
    const villageVisits = villageRows.length;
    const noCanonicalResults = historicalServices === 0 && villageVisits === 0 && unexpectedResults === 0;
    const preparedCounts = statusCounts(records);
    const preparedCountsMatch = batch.totalRows === sourceRows
      && batch.validRows === preparedCounts.validRows
      && batch.rejectedRows === preparedCounts.rejectedRows
      && batch.reviewRows === preparedCounts.reviewRows
      && batch.skippedRows === preparedCounts.skippedRows;
    const computedChecksum = reconciliationChecksum(records);
    let consistent = false;
    if (batch.status === 'COMPLETED') {
      consistent = batch.totalRows === sourceRows
        && batch.rejectedRows === 0
        && batch.reviewRows === 0
        && batch.validRows === importedRows
        && batch.importedRows === importedRows
        && batch.skippedRows === skippedRows
        && importedRows + skippedRows === sourceRows
        && historicalServices + villageVisits === importedRows
        && incompleteImportedRows === 0
        && unexpectedResults === 0
        && sourceOutcomeMismatches === 0
        && Boolean(batch.reconciliationChecksum)
        && batch.reconciliationChecksum === computedChecksum;
    } else if (['VALIDATED', 'APPROVED', 'REVIEW_REQUIRED', 'FAILED'].includes(batch.status)) {
      consistent = preparedCountsMatch && batch.importedRows === 0 && noCanonicalResults;
    } else if (batch.status === 'SUPERSEDED') {
      const entirelyRolledBack = sourceRows === (sourceRecordStatusCounts.ROLLED_BACK || 0);
      consistent = batch.totalRows === sourceRows
        && batch.importedRows === 0
        && noCanonicalResults
        && (preparedCountsMatch || entirelyRolledBack);
    } else if (batch.status === 'ROLLED_BACK') {
      consistent = batch.totalRows === sourceRows
        && sourceRows === (sourceRecordStatusCounts.ROLLED_BACK || 0)
        && batch.importedRows === 0
        && Boolean(batch.rolledBackAt)
        && noCanonicalResults;
    } else if (batch.status === 'STAGED') {
      consistent = batch.totalRows === sourceRows && batch.importedRows === 0 && noCanonicalResults;
    }

    return {
      batchId,
      status: batch.status,
      sourceRows,
      sourceRecordStatusCounts,
      sourceSystemCounts,
      importedRows,
      skippedRows,
      historicalServices,
      villageVisits,
      createdCustomers,
      incompleteImportedRows,
      unexpectedResults,
      sourceOutcomeMismatches,
      hasReconciliationChecksum: Boolean(batch.reconciliationChecksum),
      reconciliationChecksumMatches: batch.status === 'COMPLETED'
        ? batch.reconciliationChecksum === computedChecksum
        : null,
      ok: consistent,
      consistent,
    };
  }, { isolationLevel: 'RepeatableRead' });
}

module.exports = {
  getReferenceData,
  findCustomersByPhones,
  findPriorImportedSourceRecords,
  findBatchByChecksumMapping,
  createPreparedBatch,
  createSupersedingPreparedBatch,
  getBatchWithSafeRecords,
  getBatchWithPayloadRecords,
  approveBatch,
  commitBatch,
  abortBatch,
  purgeExpiredPayloads,
  verifyBatch,
  commitActions,
  disconnect: () => prisma.$disconnect(),
};
