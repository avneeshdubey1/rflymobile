const appealRepository = require('../src/repositories/appealRepository');
const leadRepository = require('../src/repositories/leadRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const geofenceService = require('../services/geofenceService');
const autoAssignmentService = require('../services/autoAssignmentService');
const whatsappService = require('../services/whatsappService');

exports.create = async (req, res) => {
  try {
    const lead = await leadRepository.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status !== 'OUT_OF_RANGE') return res.status(409).json({ error: 'Only out-of-range leads can request an appeal' });
    const existing = await appealRepository.findByLeadId(lead.id);
    if (existing) return res.status(409).json({ error: 'An appeal already exists for this lead' });
    const { nearestCenter, distanceKm } = await geofenceService.evaluate(lead.latitude, lead.longitude);
    const offer = await geofenceService.suggestedAppealFee(distanceKm, nearestCenter);
    const appeal = await appealRepository.create({ leadId: lead.id, distanceKm, excessKm: offer.excessKm, suggestedFee: offer.suggestedFee, farmerMessage: req.body.farmerMessage });
    const updatedLead = await leadRepository.update(lead.id, { status: 'APPEAL_PENDING' });
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'APPEAL_REQUESTED', beforeState: lead, afterState: updatedLead, reason: req.body.farmerMessage || null });
    res.status(201).json({ success: true, appeal });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to request appeal' }); }
};

exports.review = async (req, res) => {
  try {
    const appeal = await appealRepository.findByLeadId(req.params.leadId);
    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    if (appeal.status !== 'PENDING') return res.status(409).json({ error: 'Appeal has already been reviewed' });
    const approved = req.body.decision === 'APPROVED';
    if (!approved && req.body.decision !== 'REJECTED') return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    const finalFee = approved ? Number(req.body.finalFee ?? appeal.suggestedFee) : null;
    if (approved && (!Number.isFinite(finalFee) || finalFee < 0)) return res.status(400).json({ error: 'finalFee must be a non-negative number' });
    const reviewed = await appealRepository.update(appeal.id, { status: req.body.decision, finalFee, reviewedBy: req.auth.userId, resolvedAt: new Date() });
    const location = approved ? await geofenceService.evaluate(appeal.lead.latitude, appeal.lead.longitude) : null;
    const lead = await leadRepository.update(appeal.leadId, {
      status: approved ? 'PROCESSED' : 'REJECTED', processedAt: approved ? new Date() : null,
      matchedCenterId: approved ? location.nearestCenter?.id || null : undefined,
      distanceFromCenterKm: approved ? location.distanceKm : undefined,
    });
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: `APPEAL_${req.body.decision}`, actorId: req.auth.userId, afterState: lead, reason: req.body.reason || null });
    await whatsappService.sendLeadMessage(lead, approved ? 'appeal_approved' : 'appeal_rejected', approved ? { fee: `₹${reviewed.finalFee}` } : {});
    if (approved) await whatsappService.sendForStatus(lead, 'PROCESSED');
    const assignment = approved ? await autoAssignmentService.autoAssignProcessedLead(lead.id) : null;
    res.json({ success: true, appeal: reviewed, lead, assignment });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to review appeal' }); }
};
