const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');

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
    const center = await operatingCenterRepository.create({
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radiusKm: parseFloat(radiusKm),
      active: active !== undefined ? active : true
    });
    res.status(201).json({ success: true, center });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add operating center' });
  }
};

exports.deleteCenter = async (req, res) => {
  try {
    // Delete logic via repository if exists, wait, let's look if it exists. 
    // Delete by id is not in operatingCenterRepository, I need to add it or use prisma directly.
    const prisma = require('../src/lib/prisma');
    await prisma.operatingCenter.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete center' });
  }
};
