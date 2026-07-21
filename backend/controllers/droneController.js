const droneRepository = require('../src/repositories/droneRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const validStatuses = new Set(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']);

async function updateStatus(req, res, status) {
  const before = await droneRepository.findById(req.body.droneId);
  if (!before) return res.status(404).json({ error: 'Drone not found' });
  const drone = await droneRepository.update(before.id, { status });
  await auditLogRepository.create({ entityType: 'Drone', entityId: drone.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: before, afterState: drone, reason: req.body.reason || null });
  return res.json({ success: true, drone });
}

exports.getActiveDrones = async (_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll({ status: 'AVAILABLE' }) }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };
exports.getAllDrones = async (_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };
exports.addDrone = async (req, res) => {
  try {
    const { model, serialNumber, homeCenterId } = req.body;
    if (!model || !serialNumber || !homeCenterId) return res.status(400).json({ error: 'Model, serial number, and home center are required' });
    const drone = await droneRepository.create({ model, serialNumber, homeCenterId, status: 'AVAILABLE' });
    await auditLogRepository.create({ entityType: 'Drone', entityId: drone.id, action: 'CREATED', actorId: req.auth.userId, afterState: drone });
    res.status(201).json({ success: true, drone });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Serial number already exists' });
    res.status(500).json({ error: 'Failed to add drone' });
  }
};
exports.requestMaintenance = async (req, res) => { try { await updateStatus(req, res, 'MAINTENANCE'); } catch { res.status(500).json({ error: 'Failed to request maintenance' }); } };
exports.resolveMaintenance = async (req, res) => { try { await updateStatus(req, res, req.body.action === 'approve' ? 'MAINTENANCE' : 'AVAILABLE'); } catch { res.status(500).json({ error: 'Failed to resolve maintenance' }); } };
exports.updateStatus = async (req, res) => { try { if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Invalid drone status' }); await updateStatus(req, res, req.body.status); } catch { res.status(500).json({ error: 'Failed to update drone status' }); } };
exports.inquire = async (req, res) => { try { const drone = await droneRepository.findById(req.body.droneId); if (!drone) return res.status(404).json({ error: 'Drone not found' }); res.json({ success: true, message: 'Inquiry workflow is scheduled for Phase 6 chat' }); } catch { res.status(500).json({ error: 'Failed to find drone' }); } };
