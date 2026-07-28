const portalService = require('../services/portalService');

exports.farmerSummary = async (req, res) => {
  try {
    const portal = await portalService.farmerPortal(req.authUser);
    return res.json({ success: true, portal });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status === 403 ? error.message : 'Failed to load Farmer portal' });
  }
};

exports.businessSummary = async (req, res) => {
  try {
    const portal = await portalService.businessPortal(req.authUser);
    return res.json({ success: true, portal });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status === 403 ? error.message : 'Failed to load Business portal' });
  }
};
