const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const { setHistoryActor } = require('./historyActorRepository');
const { sanitizeAuditState } = require('./auditLogRepository');
const { stable, digest } = require('../../importer/clientMasterWorkbookV1');
const { hashPassword } = require('../../services/passwordService');

const TX_OPTIONS = { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 120_000 };

function importError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function inactivePilotEmail(employeeCode) {
  return `rfly-import+${String(employeeCode).toLowerCase()}@invalid.local`;
}

async function context(client, { actorId, centerId, canonical }) {
  const [actor, center, values, crops, clusters, pilots, drones, lmvs] = await Promise.all([
    client.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, active: true, archivedAt: true } }),
    client.operatingCenter.findUnique({ where: { id: centerId }, select: { id: true, active: true } }),
    client.masterDataValue.findMany({ where: { OR: [
      { category: 'SPRAY_PURPOSE', code: { in: canonical.purposes.map((item) => item.code) } },
      { category: 'B2B_SUBCATEGORY', code: { in: canonical.b2bSubcategories.map((item) => item.code) } },
      { category: 'B2C_CLASSIFICATION', code: { in: canonical.b2cClassifications.map((item) => item.code) } },
      { category: 'LEAD_SOURCE', code: { in: canonical.leadSources.map((item) => item.code) } },
      { category: 'REPORTING_ADMIN', code: { in: canonical.reportingAdmins.map((item) => item.code) } },
    ] } }),
    client.crop.findMany({ where: { OR: [
      { code: { in: canonical.crops.map((item) => item.code) } },
      { normalizedName: { in: canonical.crops.map((item) => item.normalizedName) } },
    ] } }),
    client.cluster.findMany({ where: { code: { in: canonical.clusters.map((item) => item.code) } } }),
    client.user.findMany({ where: { employeeCode: { in: canonical.pilots.map((item) => item.employeeCode) } } }),
    client.drone.findMany({ where: { serialNumber: { in: canonical.drones.map((item) => item.serialNumber) } } }),
    client.lMV.findMany({ where: { registrationNo: { in: canonical.lmvs.map((item) => item.registrationNo) } } }),
  ]);
  if (!actor || actor.role !== 'ADMIN' || !actor.active || actor.archivedAt) throw importError('MASTER_IMPORT_ADMIN_REQUIRED', 'An active Admin account is required');
  if (!center || !center.active) throw importError('MASTER_IMPORT_CENTER_REQUIRED', 'An active operating center is required');
  return { actor, center, values, crops, clusters, pilots, drones, lmvs };
}

function classifiedRows(canonical, existing) {
  const values = new Map(existing.values.map((item) => [`${item.category}:${item.code}`, item]));
  const crops = new Map(existing.crops.map((item) => [item.code, item]));
  const cropsByNormalizedName = new Map(existing.crops.map((item) => [item.normalizedName, item]));
  const clusters = new Map(existing.clusters.map((item) => [item.code, item]));
  const pilots = new Map(existing.pilots.map((item) => [item.employeeCode, item]));
  const drones = new Map(existing.drones.map((item) => [item.serialNumber, item]));
  const lmvs = new Map(existing.lmvs.map((item) => [item.registrationNo, item]));
  const rows = [];
  const addMasters = (category, items) => items.forEach((item) => {
    const current = values.get(`${category}:${item.code}`);
    rows.push({ kind: 'MASTER_VALUE', key: `${category}:${item.code}`, action: !current ? 'CREATE' : current.displayName === item.displayName ? 'SKIP_EXACT' : 'REVIEW_EXISTING_DIFFERENCE' });
  });
  addMasters('SPRAY_PURPOSE', canonical.purposes);
  addMasters('B2B_SUBCATEGORY', canonical.b2bSubcategories);
  addMasters('B2C_CLASSIFICATION', canonical.b2cClassifications);
  addMasters('LEAD_SOURCE', canonical.leadSources);
  addMasters('REPORTING_ADMIN', canonical.reportingAdmins);
  canonical.crops.forEach((item) => {
    const current = crops.get(item.code) || cropsByNormalizedName.get(item.normalizedName);
    rows.push({ kind: 'CROP', key: item.code, action: !current ? 'CREATE' : current.normalizedName === item.normalizedName ? 'SKIP_EXACT' : 'REVIEW_EXISTING_DIFFERENCE' });
  });
  canonical.clusters.forEach((item) => {
    const current = clusters.get(item.code);
    rows.push({ kind: 'CLUSTER', key: item.code, action: !current ? 'CREATE' : current.displayName === item.displayName && current.type === item.type ? 'SKIP_EXACT' : 'REVIEW_EXISTING_DIFFERENCE' });
  });
  canonical.pilots.forEach((item) => {
    const current = pilots.get(item.employeeCode);
    rows.push({ kind: 'PILOT_ROSTER', key: item.employeeCode, action: !current ? 'CREATE_INACTIVE' : current.role === 'PILOT' && current.name === item.name ? 'SKIP_EXACT' : 'REVIEW_EXISTING_DIFFERENCE' });
  });
  canonical.drones.forEach((item) => rows.push({ kind: 'DRONE', key: item.serialNumber, action: drones.has(item.serialNumber) ? 'SKIP_EXISTING' : 'CREATE_OUT_OF_SERVICE' }));
  canonical.lmvs.forEach((item) => rows.push({ kind: 'LMV', key: item.registrationNo, action: lmvs.has(item.registrationNo) ? 'SKIP_EXISTING' : 'CREATE_OUT_OF_SERVICE' }));
  return rows;
}

function buildPlan(input, existing) {
  const rows = classifiedRows(input.canonical, existing);
  const counts = Object.fromEntries(['CREATE', 'CREATE_INACTIVE', 'CREATE_OUT_OF_SERVICE', 'SKIP_EXACT', 'SKIP_EXISTING', 'REVIEW_EXISTING_DIFFERENCE']
    .map((action) => [action, rows.filter((row) => row.action === action).length]));
  return { planHash: digest(stable({ fileChecksum: input.fileChecksum, centerId: input.centerId, mappingVersion: input.mappingVersion, rows })), counts, rows };
}

async function plan(input) {
  return buildPlan(input, await context(prisma, input));
}

async function commit(input) {
  const pilotPasswordHashes = new Map();
  for (const pilot of input.canonical.pilots) {
    pilotPasswordHashes.set(pilot.employeeCode, await hashPassword(crypto.randomBytes(48).toString('base64url')));
  }
  return prisma.$transaction(async (transaction) => {
    const resolved = await context(transaction, input);
    const currentPlan = buildPlan(input, resolved);
    if (currentPlan.planHash !== input.expectedPlanHash) throw importError('MASTER_IMPORT_PLAN_DRIFT', 'The database or import plan changed after review');
    if (currentPlan.counts.REVIEW_EXISTING_DIFFERENCE) throw importError('MASTER_IMPORT_REVIEW_REQUIRED', 'The import plan contains existing-data differences requiring review');
    await setHistoryActor(transaction, input.actorId);
    const created = { values: 0, crops: 0, clusters: 0, pilots: 0, drones: 0, lmvs: 0 };
    const valueRows = [
      ['SPRAY_PURPOSE', input.canonical.purposes], ['B2B_SUBCATEGORY', input.canonical.b2bSubcategories],
      ['B2C_CLASSIFICATION', input.canonical.b2cClassifications], ['LEAD_SOURCE', input.canonical.leadSources],
      ['REPORTING_ADMIN', input.canonical.reportingAdmins],
    ];
    for (const [category, items] of valueRows) for (const item of items) {
      const found = resolved.values.find((value) => value.category === category && value.code === item.code);
      if (!found) { await transaction.masterDataValue.create({ data: { category, ...item, active: true } }); created.values += 1; }
    }
    for (const item of input.canonical.crops) if (!resolved.crops.some((crop) => crop.code === item.code || crop.normalizedName === item.normalizedName)) {
      await transaction.crop.create({ data: item }); created.crops += 1;
    }
    for (const item of input.canonical.clusters) if (!resolved.clusters.some((cluster) => cluster.code === item.code)) {
      await transaction.cluster.create({ data: { ...item, active: true } }); created.clusters += 1;
    }
    const droneIds = new Map(resolved.drones.map((item) => [item.serialNumber, item.id]));
    for (const item of input.canonical.drones) if (!droneIds.has(item.serialNumber)) {
      const drone = await transaction.drone.create({ data: { name: item.serialNumber, model: 'CLIENT_MASTER_UNSPECIFIED', serialNumber: item.serialNumber, homeCenterId: input.centerId, status: 'OUT_OF_SERVICE', operationalState: 'OUT_OF_SERVICE', availabilityState: 'UNAVAILABLE', certified: false } });
      droneIds.set(item.serialNumber, drone.id); created.drones += 1;
    }
    const lmvIds = new Map(resolved.lmvs.map((item) => [item.registrationNo, item.id]));
    for (const item of input.canonical.lmvs) if (!lmvIds.has(item.registrationNo)) {
      const lmv = await transaction.lMV.create({ data: { registrationNo: item.registrationNo, label: item.label || null, homeCenterId: input.centerId, capacity: 1, status: 'OUT_OF_SERVICE', operationalState: 'OUT_OF_SERVICE', availabilityState: 'UNAVAILABLE', notes: item.gensetReference ? `Imported genset reference: ${item.gensetReference}` : null } });
      lmvIds.set(item.registrationNo, lmv.id); created.lmvs += 1;
    }
    for (const item of input.canonical.pilots) if (!resolved.pilots.some((pilot) => pilot.employeeCode === item.employeeCode)) {
      const user = await transaction.user.create({ data: { name: item.name, email: inactivePilotEmail(item.employeeCode), employeeCode: item.employeeCode, passwordHash: pilotPasswordHashes.get(item.employeeCode), role: 'PILOT', active: false, pilotAvailabilityState: 'OFFLINE', homeCenterId: input.centerId, assignedDroneId: item.droneSerialNumber ? droneIds.get(item.droneSerialNumber) || null : null, assignedLmvId: item.lmvRegistrationNo ? lmvIds.get(item.lmvRegistrationNo) || null : null, preferences: { importedRoster: true, generatedEmployeeCode: item.generatedEmployeeCode } } });
      created.pilots += 1;
      await transaction.auditLog.create({ data: { entityType: 'User', entityId: user.id, action: 'IMPORTED_INACTIVE_PILOT_ROSTER', actorId: input.actorId, afterState: sanitizeAuditState({ employeeCode: item.employeeCode, active: false, homeCenterId: input.centerId, mappingVersion: input.mappingVersion }), reason: 'CONTROLLED_CLIENT_MASTER_IMPORT' } });
    }
    await transaction.auditLog.create({ data: { entityType: 'ClientMasterImport', entityId: currentPlan.planHash, action: 'IMPORT_COMMITTED', actorId: input.actorId, afterState: sanitizeAuditState({ created, skipped: currentPlan.counts.SKIP_EXACT + currentPlan.counts.SKIP_EXISTING, fileChecksum: input.fileChecksum, backupEvidenceReference: input.backupReference, mappingVersion: input.mappingVersion }), reason: 'CONTROLLED_CLIENT_MASTER_IMPORT_COMPLETE' } });
    return { planHash: currentPlan.planHash, created, skipped: currentPlan.counts.SKIP_EXACT + currentPlan.counts.SKIP_EXISTING, total: currentPlan.rows.length };
  }, TX_OPTIONS);
}

module.exports = { commit, disconnect: () => prisma.$disconnect(), plan };
