const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const { setHistoryActor } = require('./historyActorRepository');
const auditLogRepository = require('./auditLogRepository');

const TX_OPTIONS = { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 120_000 };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function comparable(drone) {
  return {
    name: drone.name || null,
    type: drone.type || null,
    category: drone.category || null,
    model: drone.model,
    manufacturer: drone.manufacturer || null,
    serialNumber: drone.serialNumber,
    uin: drone.uin || null,
    location: drone.location || null,
    tankCapacity: drone.tankCapacity == null ? null : Number(drone.tankCapacity),
    tankCapacityLitres: drone.tankCapacityLitres == null ? null : Number(drone.tankCapacityLitres),
    batteryCapacity: drone.batteryCapacity,
    batteryCapacityMah: drone.batteryCapacityMah,
    endurance: drone.endurance,
    enduranceMinutes: drone.enduranceMinutes,
    certified: drone.certified,
    serviceType: drone.serviceType || null,
    status: drone.status,
    operationalState: drone.operationalState,
    availabilityState: drone.availabilityState,
    homeCenterId: drone.homeCenterId,
  };
}

async function context(client, { actorId, centerId, assets }) {
  const [actor, center, existing] = await Promise.all([
    client.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, active: true, archivedAt: true } }),
    client.operatingCenter.findUnique({ where: { id: centerId }, select: { id: true, code: true, active: true } }),
    client.drone.findMany({
      where: { OR: [{ serialNumber: { in: assets.map((item) => item.drone.serialNumber) } }, { uin: { in: assets.map((item) => item.drone.uin) } }] },
    }),
  ]);
  if (!actor || actor.role !== 'ADMIN' || !actor.active || actor.archivedAt) {
    const error = new Error('An active Admin account is required for drone import');
    error.code = 'DRONE_IMPORT_ADMIN_REQUIRED';
    throw error;
  }
  if (!center || !center.active) {
    const error = new Error('An active operating centre is required for drone import');
    error.code = 'DRONE_IMPORT_CENTER_REQUIRED';
    throw error;
  }
  return { actor, center, existing };
}

function buildPlan({ assets, existing, centerId, fileChecksum, mappingVersion }) {
  const bySerial = new Map(existing.map((item) => [item.serialNumber, item]));
  const byUin = new Map(existing.filter((item) => item.uin).map((item) => [item.uin, item]));
  const rows = assets.map((asset) => {
    const serialMatch = bySerial.get(asset.drone.serialNumber);
    const uinMatch = byUin.get(asset.drone.uin);
    if (serialMatch && uinMatch && serialMatch.id !== uinMatch.id) {
      return { sourceIndex: asset.sourceIndex, serialNumber: asset.drone.serialNumber, uin: asset.drone.uin, action: 'CONFLICT_SPLIT_IDENTITY' };
    }
    const match = serialMatch || uinMatch;
    const desired = { ...asset.drone, homeCenterId: centerId };
    if (!match) return { sourceIndex: asset.sourceIndex, serialNumber: asset.drone.serialNumber, uin: asset.drone.uin, action: 'CREATE' };
    if (hash(comparable(match)) === hash(comparable(desired))) {
      return { sourceIndex: asset.sourceIndex, serialNumber: asset.drone.serialNumber, uin: asset.drone.uin, action: 'SKIP_EXACT', existingId: match.id };
    }
    return { sourceIndex: asset.sourceIndex, serialNumber: asset.drone.serialNumber, uin: asset.drone.uin, action: 'REVIEW_EXISTING_DIFFERENCE', existingId: match.id };
  });
  const counts = Object.fromEntries(['CREATE', 'SKIP_EXACT', 'CONFLICT_SPLIT_IDENTITY', 'REVIEW_EXISTING_DIFFERENCE']
    .map((action) => [action, rows.filter((row) => row.action === action).length]));
  const planHash = hash({ fileChecksum, mappingVersion, centerId, rows });
  return { planHash, counts, rows };
}

async function plan(input) {
  const resolved = await context(prisma, input);
  return buildPlan({ ...input, existing: resolved.existing });
}

async function commit(input) {
  return prisma.$transaction(async (transaction) => {
    const resolved = await context(transaction, input);
    const currentPlan = buildPlan({ ...input, existing: resolved.existing });
    if (currentPlan.planHash !== input.expectedPlanHash) {
      const error = new Error('The database or import plan changed after review');
      error.code = 'DRONE_IMPORT_PLAN_DRIFT';
      throw error;
    }
    if (currentPlan.counts.CONFLICT_SPLIT_IDENTITY || currentPlan.counts.REVIEW_EXISTING_DIFFERENCE) {
      const error = new Error('The import plan contains unresolved existing-drone differences');
      error.code = 'DRONE_IMPORT_REVIEW_REQUIRED';
      throw error;
    }
    await setHistoryActor(transaction, input.actorId);
    const createdIds = [];
    for (const row of currentPlan.rows.filter((item) => item.action === 'CREATE')) {
      const source = input.assets.find((item) => item.sourceIndex === row.sourceIndex);
      const created = await transaction.drone.create({ data: { ...source.drone, homeCenterId: input.centerId }, select: { id: true } });
      createdIds.push(created.id);
      await transaction.auditLog.create({
        data: {
          entityType: 'Drone', entityId: created.id, action: 'IMPORTED', actorId: input.actorId,
          afterState: auditLogRepository.sanitizeAuditState({
            serialNumber: row.serialNumber, uin: row.uin, homeCenterId: input.centerId,
            mappingVersion: input.mappingVersion, sourceIndex: row.sourceIndex,
          }),
          reason: 'CONTROLLED_CLIENT_DRONE_IMPORT',
        },
      });
    }
    await transaction.auditLog.create({
      data: {
        entityType: 'DroneImport', entityId: currentPlan.planHash, action: 'IMPORT_COMMITTED', actorId: input.actorId,
        afterState: { created: createdIds.length, skipped: currentPlan.counts.SKIP_EXACT, fileChecksum: input.fileChecksum, backupEvidenceReference: input.backupReference },
        reason: 'CONTROLLED_CLIENT_DRONE_IMPORT_COMPLETE',
      },
    });
    return { planHash: currentPlan.planHash, created: createdIds.length, skipped: currentPlan.counts.SKIP_EXACT, total: currentPlan.rows.length };
  }, TX_OPTIONS);
}

module.exports = { buildPlan, commit, disconnect: () => prisma.$disconnect(), plan };
