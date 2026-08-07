const autoAssignmentService = require('../services/autoAssignmentService');

exports.assign = async (req, res) => {
  try {
    const result = await autoAssignmentService.autoAssignProcessedLead(req.params.leadId, { actorId: req.auth.userId });
    res.json({ success: true, result });
  } catch (error) {
    if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
    return res.status(400).json({ error: error.message || 'Auto-assignment failed' });
  }
};
