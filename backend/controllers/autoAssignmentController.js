const autoAssignmentService = require('../services/autoAssignmentService');
const { ServiceAreaValidationError } = require('../services/leadServiceAreaService');

exports.assign = async (req, res) => {
  try {
    const result = await autoAssignmentService.autoAssignProcessedLead(req.params.leadId);
    res.json({ success: true, result });
  } catch (error) {
    if (error instanceof ServiceAreaValidationError) return res.status(409).json({ code: error.code });
    return res.status(400).json({ error: error.message || 'Auto-assignment failed' });
  }
};
