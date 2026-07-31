const droneRepository = require('../src/repositories/droneRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const validStatuses = new Set(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']);

function optionalText(value, maximum = 120) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (text.length > maximum) throw new Error(`Drone text fields must not exceed ${maximum} characters`);
  return text;
}

function optionalPositiveNumber(value, field, { integer = false } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isInteger(number))) throw new Error(`${field} must be a positive ${integer ? 'whole ' : ''}number`);
  return number;
}

async function assertNoActiveAssignment(droneId) {
  const active = await assignmentRepository.findActiveForDrone(droneId);
  if (active.length) {
    const error = new Error('An assigned drone cannot change availability while active missions exist');
    error.statusCode = 409;
    throw error;
  }
}

exports.getActiveDrones = async (_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll({ status: 'AVAILABLE' }) }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };
exports.getAllDrones = async (_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };
exports.addDrone = async (req, res) => {
  try {
    const { model, serialNumber, homeCenterId } = req.body;
    if (!model || !serialNumber || !homeCenterId) return res.status(400).json({ error: 'Model, serial number, and home center are required' });
    const drone = await droneRepository.create({
      name: optionalText(req.body.name),
      model: String(model).trim(),
      serialNumber: String(serialNumber).trim(),
      category: optionalText(req.body.category, 60),
      manufacturer: optionalText(req.body.manufacturer),
      tankCapacityLitres: optionalPositiveNumber(req.body.tankCapacityLitres, 'Tank capacity'),
      batteryCapacityMah: optionalPositiveNumber(req.body.batteryCapacityMah, 'Battery capacity', { integer: true }),
      enduranceMinutes: optionalPositiveNumber(req.body.enduranceMinutes, 'Endurance', { integer: true }),
      certified: req.body.certified === true,
      serviceType: optionalText(req.body.serviceType),
      homeCenterId,
      status: 'AVAILABLE',
    });
    await auditLogRepository.create({ entityType: 'Drone', entityId: drone.id, action: 'CREATED', actorId: req.auth.userId, afterState: drone });
    res.status(201).json({ success: true, drone });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Serial number already exists' });
    res.status(/must|required/i.test(error.message || '') ? 400 : 500).json({ error: /must|required/i.test(error.message || '') ? error.message : 'Failed to add drone' });
  }
};
exports.updateStatus = async (req, res) => {
  try {
    if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Invalid drone status' });
    const before = await droneRepository.findById(req.body.droneId);
    if (!before) return res.status(404).json({ error: 'Drone not found' });
    if (req.body.status === 'ASSIGNED' && before.status !== 'ASSIGNED') {
      return res.status(409).json({ error: 'ASSIGNED status is controlled by mission scheduling' });
    }
    if (before.status === 'ASSIGNED' && req.body.status !== 'ASSIGNED') await assertNoActiveAssignment(before.id);
    if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(req.body.status)) await assertNoActiveAssignment(before.id);
    const drone = await droneRepository.update(before.id, { status: req.body.status });
    await auditLogRepository.create({
      entityType: 'Drone',
      entityId: drone.id,
      action: 'STATUS_CHANGE',
      actorId: req.auth.userId,
      beforeState: before,
      afterState: drone,
      reason: req.body.reason || null,
    });
    return res.json({ success: true, drone });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update drone status' });
  }
};
