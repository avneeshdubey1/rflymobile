const masterDataRepository = require('../src/repositories/masterDataRepository');
const auditLogService = require('./auditLogService');

const CATEGORIES = new Set(['SPRAY_PURPOSE', 'B2B_SUBCATEGORY', 'B2C_CLASSIFICATION', 'LEAD_SOURCE', 'REPORTING_ADMIN']);
const CLUSTER_TYPES = new Set(['CLUSTER', 'HUB', 'SPOKE', 'MINIHUB']);

function text(value, field, maximum) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maximum) throw Object.assign(new Error(`${field} is required and must not exceed ${maximum} characters`), { status: 400 });
  return normalized;
}
function code(value) {
  const normalized = text(value, 'Code', 60).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
  if (!normalized) throw Object.assign(new Error('Code is invalid'), { status: 400 });
  return normalized;
}
function sortOrder(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) throw Object.assign(new Error('sortOrder must be a non-negative integer'), { status: 400 });
  return parsed;
}

async function choices() {
  const [clusters, crops, sprayPurposes, b2bSubcategories, leadSources, reportingAdmins] = await Promise.all([
    masterDataRepository.listClusters(true), masterDataRepository.listCrops(),
    masterDataRepository.listValues('SPRAY_PURPOSE', true),
    masterDataRepository.listValues('B2B_SUBCATEGORY', true),
    masterDataRepository.listValues('B2C_CLASSIFICATION', true),
    masterDataRepository.listValues('LEAD_SOURCE', true),
    masterDataRepository.listValues('REPORTING_ADMIN', true),
  ]);
  return { requestTypes: ['B2B', 'B2C'], clusters, crops, sprayPurposes, b2bSubcategories, b2cClassifications, leadSources, reportingAdmins };
}

async function listAdmin() {
  const [clusters, values, crops] = await Promise.all([
    masterDataRepository.listClusters(false),
    Promise.all([...CATEGORIES].map((category) => masterDataRepository.listValues(category, false))),
    masterDataRepository.listAllCrops(),
  ]);
  return { clusters, values: values.flat(), crops };
}

async function createCluster(input, actorId) {
  const type = String(input.type || '').toUpperCase();
  if (!CLUSTER_TYPES.has(type)) throw Object.assign(new Error('Cluster type must be CLUSTER, HUB, SPOKE, or MINIHUB'), { status: 400 });
  const cluster = await masterDataRepository.createCluster({ code: code(input.code), displayName: text(input.displayName, 'Display name', 120), type, sortOrder: sortOrder(input.sortOrder), active: input.active !== false });
  await auditLogService.record({ entityType: 'Cluster', entityId: cluster.id, action: 'CREATED', actorId, afterState: { code: cluster.code, type: cluster.type, active: cluster.active } });
  return cluster;
}

async function updateCluster(id, input, actorId) {
  const before = await masterDataRepository.findClusterById(id);
  if (!before) throw Object.assign(new Error('Cluster not found'), { status: 404 });
  const data = {};
  if (input.displayName !== undefined) data.displayName = text(input.displayName, 'Display name', 120);
  if (input.type !== undefined) {
    const type = String(input.type).toUpperCase();
    if (!CLUSTER_TYPES.has(type)) throw Object.assign(new Error('Cluster type must be CLUSTER, HUB, SPOKE, or MINIHUB'), { status: 400 });
    data.type = type;
  }
  if (input.active !== undefined) data.active = Boolean(input.active);
  if (input.sortOrder !== undefined) data.sortOrder = sortOrder(input.sortOrder);
  const updated = await masterDataRepository.updateCluster(id, data);
  await auditLogService.record({ entityType: 'Cluster', entityId: id, action: 'UPDATED', actorId, beforeState: { type: before.type, active: before.active }, afterState: { type: updated.type, active: updated.active } });
  return updated;
}

async function createValue(input, actorId) {
  const category = String(input.category || '').toUpperCase();
  if (!CATEGORIES.has(category)) throw Object.assign(new Error('Master-data category is invalid'), { status: 400 });
  const value = await masterDataRepository.createValue({ category, code: code(input.code), displayName: text(input.displayName, 'Display name', 160), sortOrder: sortOrder(input.sortOrder), active: input.active !== false });
  await auditLogService.record({ entityType: 'MasterDataValue', entityId: value.id, action: 'CREATED', actorId, afterState: { category, code: value.code, active: value.active } });
  return value;
}

async function updateValue(id, input, actorId) {
  const data = {};
  if (input.displayName !== undefined) data.displayName = text(input.displayName, 'Display name', 160);
  if (input.active !== undefined) data.active = Boolean(input.active);
  if (input.sortOrder !== undefined) data.sortOrder = sortOrder(input.sortOrder);
  const updated = await masterDataRepository.updateValue(id, data);
  await auditLogService.record({ entityType: 'MasterDataValue', entityId: id, action: 'UPDATED', actorId, afterState: { category: updated.category, code: updated.code, active: updated.active } });
  return updated;
}

async function createCrop(input, actorId) {
  const displayName = text(input.displayName, 'Crop name', 160);
  const normalizedName = displayName.normalize('NFKC').trim().toLowerCase();
  const crop = await masterDataRepository.createCrop({ code: code(input.code), displayName, normalizedName, active: input.active !== false });
  await auditLogService.record({ entityType: 'Crop', entityId: crop.id, action: 'CREATED', actorId, afterState: { code: crop.code, active: crop.active } });
  return crop;
}

async function updateCrop(id, input, actorId) {
  const data = {};
  if (input.displayName !== undefined) { data.displayName = text(input.displayName, 'Crop name', 160); data.normalizedName = data.displayName.normalize('NFKC').trim().toLowerCase(); }
  if (input.active !== undefined) data.active = Boolean(input.active);
  const crop = await masterDataRepository.updateCrop(id, data);
  await auditLogService.record({ entityType: 'Crop', entityId: crop.id, action: 'UPDATED', actorId, afterState: { code: crop.code, active: crop.active } });
  return crop;
}

module.exports = { choices, listAdmin, createCluster, updateCluster, createValue, updateValue, createCrop, updateCrop };
