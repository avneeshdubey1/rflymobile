const lmvRepository = require('../src/repositories/lmvRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');

const validStatuses = new Set(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']);

function normalizeRegistration(value) {
  return String(value || '').trim().toUpperCase();
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
  return {
    registrationNo,
    label: body.label ? String(body.label).trim() : null,
    homeCenterId,
    capacity,
    notes: body.notes ? String(body.notes).trim() : null,
  };
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
  try { res.json({ success: true, lmvs: await lmvRepository.findAll({ status: 'AVAILABLE' }) }); }
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
    const lmv = await lmvRepository.create({ ...data, status: 'AVAILABLE' });
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'CREATED', actorId: req.auth.userId, afterState: lmv });
    res.status(201).json({ success: true, lmv });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Registration number already exists' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
    res.status(500).json({ error: 'Failed to add LMV' });
  }
};

exports.updateLmv = async (req, res) => {
  try {
    const before = await lmvRepository.findById(req.params.id || req.body.lmvId);
    if (!before) return res.status(404).json({ error: 'LMV not found' });
    const data = serializeInput({ ...before, ...req.body });
    if (!data) return res.status(400).json({ error: 'Registration number, home center, and positive capacity are required' });
    const lmv = await lmvRepository.update(before.id, data);
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'UPDATED', actorId: req.auth.userId, beforeState: before, afterState: lmv });
    res.json({ success: true, lmv });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Registration number already exists' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
    res.status(500).json({ error: 'Failed to update LMV' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Invalid LMV status' });
    const before = await lmvRepository.findById(req.body.lmvId || req.params.id);
    if (!before) return res.status(404).json({ error: 'LMV not found' });
    if (req.body.status === 'ASSIGNED' && before.status !== 'ASSIGNED') {
      return res.status(409).json({ error: 'ASSIGNED status is controlled by mission scheduling' });
    }
    if (before.status === 'ASSIGNED' && req.body.status !== 'ASSIGNED') await assertNoActiveAssignment(before.id);
    if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(req.body.status)) await assertNoActiveAssignment(before.id);
    const lmv = await lmvRepository.update(before.id, { status: req.body.status });
    await auditLogRepository.create({ entityType: 'LMV', entityId: lmv.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: before, afterState: lmv, reason: req.body.reason || null });
    res.json({ success: true, lmv });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update LMV status' });
  }
};
