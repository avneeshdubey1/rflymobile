const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');

exports.getAllCenters = async (_req, res) => {
  try {
    res.json({ success: true, centers: await operatingCenterRepository.findAll() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch operating centers' });
  }
};

exports.addCenter = async (req, res) => {
  try {
    const { name, latitude, longitude, radiusKm, active } = req.body;
    if (!name || latitude === undefined || longitude === undefined || radiusKm === undefined) {
      return res.status(400).json({ error: 'Missing required center fields' });
    }
    const normalizedName = String(name || '').trim();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedRadiusKm = Number(radiusKm);
    if (normalizedName.length < 2 || normalizedName.length > 120
      || !Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90
      || !Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180
      || !Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0 || parsedRadiusKm > 1000) {
      return res.status(400).json({ error: 'Operating center values are invalid' });
    }
    const center = await operatingCenterRepository.create({
      name: normalizedName,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      radiusKm: parsedRadiusKm,
      active: active !== undefined ? active : true
    });
    await auditLogRepository.create({
      entityType: 'OperatingCenter',
      entityId: center.id,
      action: 'CREATED',
      actorId: req.auth.userId,
      afterState: { name: center.name, radiusKm: center.radiusKm, active: center.active },
    });
    res.status(201).json({ success: true, center });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add operating center' });
  }
};

exports.deleteCenter = async (req, res) => {
  try {
    const center = await operatingCenterRepository.findById(req.params.id);
    if (!center) return res.status(404).json({ error: 'Operating center not found' });
    await operatingCenterRepository.delete(center.id);
    await auditLogRepository.create({
      entityType: 'OperatingCenter',
      entityId: center.id,
      action: 'DELETED',
      actorId: req.auth.userId,
      beforeState: { name: center.name, radiusKm: center.radiusKm, active: center.active },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === 'P2003' ? 409 : 500).json({
      error: error.code === 'P2003'
        ? 'This operating center is still assigned to people, drones, LMVs, or requests'
        : 'Failed to delete center',
    });
  }
};
