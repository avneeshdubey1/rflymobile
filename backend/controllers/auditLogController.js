const auditLogService = require('../services/auditLogService');

exports.getTimeline = async (req, res) => {
  try {
    if (!req.query.entityType || !req.query.entityId) return res.status(400).json({ error: 'entityType and entityId are required' });
    const timeline = await auditLogService.getTimeline(req.query.entityType, req.query.entityId);
    res.json({ success: true, ...timeline });
  } catch (error) {
    res.status(error.message === 'Lead not found' ? 404 : 500).json({ error: error.message || 'Failed to fetch audit timeline' });
  }
};
