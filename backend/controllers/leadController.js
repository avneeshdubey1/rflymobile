const leadRepository = require('../src/repositories/leadRepository');
const auditLogService = require('../services/auditLogService');
const autoAssignmentService = require('../services/autoAssignmentService');
const whatsappService = require('../services/whatsappService');
const { ServiceAreaValidationError, revalidateForScheduling } = require('../services/leadServiceAreaService');

exports.getAllLeads = async (_req, res) => {
  try {
    return res.json({ success: true, leads: await leadRepository.findAll() });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

exports.getPendingLeads = async (_req, res) => {
  try {
    const leads = await leadRepository.findAll({
      status: { in: ['NEW', 'MANUAL_CALL_REQUIRED', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING'] },
    });
    return res.json({ success: true, leads });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

exports.processLead = async (req, res) => {
  try {
    const before = await leadRepository.findById(req.body.id);
    if (!before) return res.status(404).json({ error: 'Lead not found' });
    if (!['NEW', 'MANUAL_CALL_REQUIRED'].includes(before.status)) {
      return res.status(409).json({ error: 'Only requests awaiting Sales review can be processed' });
    }
    const serviceable = await revalidateForScheduling(before, { actorId: req.auth.userId });
    const detailFields = [
      ['Mandal', req.body.mandal],
      ['District', req.body.district],
      ['Soil type', req.body.soilType],
      ['Crop age', req.body.cropAge],
      ['Product', req.body.pesticideBrand],
      ['Expected spraying', req.body.expectedSpraying],
    ].filter(([, value]) => String(value || '').trim())
      .map(([label, value]) => `${label}: ${String(value).trim().slice(0, 160)}`);
    const lead = await leadRepository.updateOperational(serviceable.id, {
      status: 'PROCESSED',
      processedAt: new Date(),
      notes: detailFields.length ? detailFields.join('\n') : serviceable.notes,
    }, { actorId: req.auth.userId });
    await auditLogService.record({
      entityType: 'Lead',
      entityId: lead.id,
      action: 'SALES_REVIEW_ACCEPTED',
      actorId: req.auth.userId,
      beforeState: { status: before.status, matchedCenterId: before.matchedCenterId },
      afterState: { status: lead.status, matchedCenterId: lead.matchedCenterId },
    });
    await whatsappService.sendForStatus(lead, 'PROCESSED');
    const assignment = await autoAssignmentService.autoAssignProcessedLead(lead.id, { actorId: req.auth.userId });
    return res.json({ success: true, lead, assignment });
  } catch (error) {
    if (error instanceof ServiceAreaValidationError) return res.status(409).json({ code: error.code });
    return res.status(500).json({ error: error.message || 'Failed to process lead' });
  }
};
