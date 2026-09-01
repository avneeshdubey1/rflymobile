const maintenanceRequestRepository = require('../src/repositories/maintenanceRequestRepository');

const statuses = new Set(['PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED']);
const reasonCodes = {
  DRONE: new Set(['BATTERY_NOT_CHARGED', 'PROPELLER_DAMAGED', 'ELECTRICAL_ISSUE', 'OTHER']),
  LMV: new Set(['VEHICLE_BREAKDOWN', 'TYRE_ISSUE', 'ENGINE_ISSUE', 'ELECTRICAL_ISSUE', 'OTHER']),
};

async function create(req, res) {
  try {
    const assetType = String(req.body?.assetType || '').toUpperCase();
    const assetId = String(req.body?.assetId || '').trim();
    const reasonCode = String(req.body?.reasonCode || '').toUpperCase();
    const reason = String(req.body?.reason || '').trim();
    if (!reasonCodes[assetType] || !assetId || !reasonCodes[assetType].has(reasonCode)) {
      return res.status(400).json({ error: 'A valid asset and maintenance reason are required' });
    }
    if (reason.length < 3 || reason.length > 500) {
      return res.status(400).json({ error: 'A maintenance note of 3 to 500 characters is required' });
    }
    const result = await maintenanceRequestRepository.createFromOperations({
      assetType,
      assetId,
      requestedById: req.auth.userId,
      reasonCode,
      reason,
    });
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Maintenance request could not be created' });
  }
}

async function list(req, res) {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    if (status && !statuses.has(status)) return res.status(400).json({ error: 'Invalid maintenance status' });
    const requests = await maintenanceRequestRepository.list({ status });
    return res.json({ success: true, requests });
  } catch {
    return res.status(500).json({ error: 'Failed to load maintenance requests' });
  }
}

async function activity(_req, res) {
  try {
    return res.json({ success: true, activity: await maintenanceRequestRepository.listActivity() });
  } catch {
    return res.status(500).json({ error: 'Failed to load asset lifecycle activity' });
  }
}

function transition(action) {
  return async (req, res) => {
    try {
      const request = await maintenanceRequestRepository.transition({
        id: req.params.id,
        actorId: req.auth.userId,
        action,
        note: req.body?.note,
        returnToService: req.body?.returnToService === true,
      });
      if (!request) return res.status(404).json({ error: 'Maintenance request not found' });
      return res.json({ success: true, request });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Maintenance request could not be updated' });
    }
  };
}

module.exports = {
  create,
  list,
  activity,
  accept: transition('ACCEPT'),
  reject: transition('REJECT'),
  resolve: transition('RESOLVE'),
};
