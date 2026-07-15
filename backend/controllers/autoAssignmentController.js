const autoAssignmentService = require('../services/autoAssignmentService');

exports.assign = async (req, res) => {
  try {
    const result = await autoAssignmentService.autoAssignProcessedLead(req.params.leadId);
    res.json({ success: true, result });
  } catch (error) { res.status(400).json({ error: error.message || 'Auto-assignment failed' }); }
};
