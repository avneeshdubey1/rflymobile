const lmvRepository = require('../src/repositories/lmvRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');

const validStatuses = new Set(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']);
const lifecycleForStatus = {
  AVAILABLE: { status: 'AVAILABLE', operationalState: 'IN_SERVICE', availabilityState: 'AVAILABLE' },
  ASSIGNED: { status: 'ASSIGNED', operationalState: 'IN_SERVICE', availabilityState: 'ASSIGNED' },
  MAINTENANCE: { status: 'MAINTENANCE', operationalState: 'MAINTENANCE', availabilityState: 'UNAVAILABLE' },
  OUT_OF_SERVICE: { status: 'OUT_OF_SERVICE', operationalState: 'OUT_OF_SERVICE', availabilityState: 'UNAVAILABLE' },
};

function normalizeRegistration(value) {
  return String(value || '').trim().toUpperCase();
}

function optionalText(value, field, maximum) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (text.length > maximum) throw new Error(`${field} must not exceed ${maximum} characters`);
  return text;
}

function parseCapacity(value) {
  const capacity = value === undefined || value === null || value === '' ? 1 : Number(value);
  if (!Number.isInteger(capacity) || capacity < 1) return null;
  return capacity;
}

function serializeInput(body) {
  const registrationNo = normalizeRegistration(body.registrationNo);
  const homeCenterId = String(body.homeCenterId || '').trim();
  const capacity = parseCapacity(body.capacity);
  if (!registrationNo || !homeCenterId || capacity === null) return null;
  if (registrationNo.length > 40) throw new Error('Registration number must not exceed 40 characters');
  return {
    registrationNo,
    label: optionalText(body.label, 'Label', 120),
    homeCenterId,
    capacity,
    notes: optionalText(body.notes, 'Notes', 1000),
  };
}

async function assertActiveCenter(homeCenterId) {
  const center = await operatingCenterRepository.findActiveById(homeCenterId);
  if (!center) {
    const error = new Error('Home center must reference an active operating center');
    error.statusCode = 400;
    throw error;
  }
}

async function assertNoActiveAssignment(lmvId) {
  const active = await assignmentRepository.findActiveForLmv(lmvId);
  if (active.length) {
    const error = new Error('An assigned LMV cannot be deactivated while active missions exist');
    error.statusCode = 409;
    throw error;
  }
}

exports.getAvailableLmvs = async (_req, res) => {
  try { res.json({ success: true, lmvs: await lmvRepository.findAll({ status: 'AVAILABLE', archivedAt: null }) }); }
  catch { res.status(500).json({ error: 'Failed to fetch LMVs' }); }
};

exports.getAllLmvs = async (_req, res) => {
  try { res.json({ success: true, lmvs: await lmvRepository.findAll() }); }
  catch { res.status(500).json({ error: 'Failed to fetch LMVs' }); }
};

exports.addLmv = async (req, res) => {
  try {
    const data = serializeInput(req.body);
    if (!data) return res.status(400).json({ error: 'Registration number, home center, and positive capacity are required' });
    await assertActiveCenter(data.homeCenterId);
    const lmv = await lmvRepository.create({ ...data, status: 'AVAILABLE' }, { actorId: req.auth.userId });
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'CREATED', actorId: req.auth.userId, afterState: lmv });
    res.status(201).json({ success: true, lmv });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Registration number already exists' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
    const status = error.statusCode || (/must|required/i.test(error.message || '') ? 400 : 500);
    res.status(status).json({ error: status === 500 ? 'Failed to add LMV' : error.message });
  }
};

exports.updateLmv = async (req, res) => {
  try {
    const before = await lmvRepository.findById(req.params.id || req.body.lmvId);
    if (!before) return res.status(404).json({ error: 'LMV not found' });
    if (before.archivedAt) return res.status(409).json({ error: 'A retired LMV cannot be updated' });
    const data = serializeInput({ ...before, ...req.body });
    if (!data) return res.status(400).json({ error: 'Registration number, home center, and positive capacity are required' });
    await assertActiveCenter(data.homeCenterId);
    if (data.homeCenterId !== before.homeCenterId) await assertNoActiveAssignment(before.id);
    const lmv = await lmvRepository.update(before.id, data, {
      actorId: req.auth.userId,
      clearIncompatiblePreferences: data.homeCenterId !== before.homeCenterId,
    });
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'UPDATED', actorId: req.auth.userId, beforeState: before, afterState: lmv });
    res.json({ success: true, lmv });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Registration number already exists' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
    if (error.code === 'P2025') return res.status(404).json({ error: 'LMV not found' });
    const status = error.statusCode || (/must|required/i.test(error.message || '') ? 400 : 500);
    res.status(status).json({ error: status === 500 ? 'Failed to update LMV' : error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Invalid LMV status' });
    const before = await lmvRepository.findById(req.body.lmvId || req.params.id);
    if (!before) return res.status(404).json({ error: 'LMV not found' });
    if (before.archivedAt) return res.status(409).json({ error: 'A retired LMV cannot change status' });
    if (req.body.status === 'ASSIGNED' && before.status !== 'ASSIGNED') {
      return res.status(409).json({ error: 'ASSIGNED status is controlled by mission scheduling' });
    }
    if (before.status === 'ASSIGNED' && req.body.status !== 'ASSIGNED') await assertNoActiveAssignment(before.id);
    if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(req.body.status)) await assertNoActiveAssignment(before.id);
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A status-change reason of 3 to 500 characters is required' });
    const lmv = await lmvRepository.update(before.id, lifecycleForStatus[req.body.status], { actorId: req.auth.userId });
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: before, afterState: lmv, reason });
    res.json({ success: true, lmv });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update LMV status' });
  }
};

exports.deleteLmv = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A retirement reason of 3 to 500 characters is required' });
    const result = await lmvRepository.retire(req.params.id, req.auth.userId, reason);
    if (!result) return res.status(404).json({ error: 'LMV not found' });
    return res.json({ success: true, retired: true, alreadyRetired: !result.changed, lmv: result.lmv });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to retire LMV' });
  }
};
