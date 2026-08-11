const autoAssignmentService = require('../services/autoAssignmentService');

exports.assign = async (req, res) => {
  try {
    const result = await autoAssignmentService.autoAssignProcessedLead(req.params.leadId, { actorId: req.auth.userId, trigger: 'OPERATOR_RETRY' });
    const status = result.outcome === 'SCHEDULED' && !result.idempotent ? 201 : 200;
    res.status(status).json({ success: true, result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ code: error.code });
    if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
    return res.status(400).json({ error: error.message || 'Auto-assignment failed' });
  }
};
