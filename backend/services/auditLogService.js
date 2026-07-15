const auditLogRepository = require('../src/repositories/auditLogRepository');
const leadRepository = require('../src/repositories/leadRepository');
const paymentRepository = require('../src/repositories/paymentRepository');

async function record(data) {
  return auditLogRepository.create(data);
}

async function getLeadTimeline(leadId) {
  const lead = await leadRepository.findById(leadId);
  if (!lead) throw new Error('Lead not found');
  const payments = await paymentRepository.findByLeadId(lead.id);
  const entries = await auditLogRepository.findTimeline(lead.id, lead.assignment?.id, payments.map((payment) => payment.id));
  return { lead, entries };
}

async function getTimeline(entityType, entityId) {
  if (!entityType || !entityId) throw new Error('entityType and entityId are required');
  if (entityType === 'Lead') return getLeadTimeline(entityId);
  return { entries: await auditLogRepository.findByEntity(entityType, entityId) };
}

module.exports = { record, getLeadTimeline, getTimeline };
