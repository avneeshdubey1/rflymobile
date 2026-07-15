const assignmentRepository = require('../src/repositories/assignmentRepository');
const paymentRepository = require('../src/repositories/paymentRepository');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');
const auditLogService = require('./auditLogService');
const notificationCascadeService = require('./notificationCascadeService');
const whatsappService = require('./whatsappService');

let upiClient = null;

function setUpiClient(client) {
  upiClient = client;
}

async function calculateAmount(assignment) {
  const rate = await pricingConfigRepository.findByKey('SPRAY_RATE_PER_ACRE');
  if (!rate || !Number.isFinite(rate.value) || rate.value <= 0) return { amount: 0, configured: false };
  const acreage = Number(assignment.actualAcreage ?? assignment.expectedAcreage);
  return { amount: Math.round(acreage * rate.value * 100) / 100, configured: true };
}

async function createPendingPayment(assignmentId) {
  const existing = await paymentRepository.findByAssignmentId(assignmentId);
  if (existing) return { payment: existing, created: false, fallback: existing.method === 'CASH' && !existing.upiLink };
  const assignment = await assignmentRepository.findById(assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  const { amount, configured } = await calculateAmount(assignment);
  await assignmentRepository.update(assignment.id, { cost: amount });
  let method = 'CASH';
  let upiLink = null;
  let upiTransactionId = null;
  let fallback = true;
  if (upiClient) {
    try {
      const generated = await upiClient.createPaymentLink({ assignmentId: assignment.id, amount, farmerName: assignment.lead.farmerName, farmerPhone: assignment.lead.farmerPhone });
      method = 'UPI';
      upiLink = generated.upiLink;
      upiTransactionId = generated.transactionId || null;
      fallback = false;
    } catch (error) {
      await auditLogService.record({ entityType: 'Assignment', entityId: assignment.id, action: 'UPI_LINK_GENERATION_FAILED', reason: error.message });
    }
  }
  const payment = await paymentRepository.create({ leadId: assignment.leadId, assignmentId: assignment.id, amount, method, status: 'PENDING', upiLink, upiTransactionId });
  await auditLogService.record({ entityType: 'PaymentRecord', entityId: payment.id, action: 'PAYMENT_RECORD_CREATED', afterState: { assignmentId: assignment.id, amount, amountConfigured: configured, method, status: 'PENDING', fallback } });
  if (!configured) await auditLogService.record({ entityType: 'PaymentRecord', entityId: payment.id, action: 'PAYMENT_AMOUNT_CONFIGURATION_MISSING', reason: 'SPRAY_RATE_PER_ACRE is missing or invalid; amount is awaiting configuration.' });
  await notificationCascadeService.createSalesNotifications('PAYMENT_PENDING', assignment.leadId, configured ? `Payment collection is pending for ${assignment.lead.farmerName}: ₹${amount}.` : `Payment collection is pending for ${assignment.lead.farmerName}; the per-acre rate still needs configuration.`);
  await whatsappService.sendMissionCompleted(assignment.lead, assignment.actualAcreage, upiLink);
  return { payment, created: true, fallback };
}

async function generateUpiLink(assignmentId) {
  const result = await createPendingPayment(assignmentId);
  const payment = result.payment;
  if (payment.upiLink) return { payment, fallback: false };
  if (!upiClient) return { payment, fallback: true };
  try {
    const generated = await upiClient.createPaymentLink({ assignmentId: payment.assignmentId, amount: payment.amount, farmerName: payment.lead.farmerName, farmerPhone: payment.lead.farmerPhone });
    const updated = await paymentRepository.update(payment.id, { method: 'UPI', upiLink: generated.upiLink, upiTransactionId: generated.transactionId || null });
    await auditLogService.record({ entityType: 'PaymentRecord', entityId: updated.id, action: 'UPI_LINK_GENERATED', afterState: { method: 'UPI', hasUpiLink: true } });
    await whatsappService.sendMissionCompleted(updated.lead, updated.assignment.actualAcreage, updated.upiLink);
    return { payment: updated, fallback: false };
  } catch (error) {
    await auditLogService.record({ entityType: 'PaymentRecord', entityId: payment.id, action: 'UPI_LINK_GENERATION_FAILED', reason: error.message });
    return { payment, fallback: true };
  }
}

async function markCashCollected(paymentId, actorId) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new Error('Payment record not found');
  if (payment.status !== 'PENDING') throw new Error('Only pending payments can be marked as cash collected');
  const updated = await paymentRepository.update(payment.id, { method: 'CASH', status: 'COMPLETED', markedCashBy: actorId, resolvedAt: new Date() });
  await auditLogService.record({ entityType: 'PaymentRecord', entityId: updated.id, action: 'CASH_PAYMENT_COLLECTED', actorId, beforeState: { status: payment.status, method: payment.method }, afterState: { status: updated.status, method: updated.method } });
  return updated;
}

async function handleWebhook(paymentId, event) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new Error('Payment record not found');
  if (!['COMPLETED', 'FAILED'].includes(event.status)) throw new Error('Webhook status must be COMPLETED or FAILED');
  if (['COMPLETED', 'FAILED'].includes(payment.status)) {
    const sameTransaction = !event.transactionId || !payment.upiTransactionId || event.transactionId === payment.upiTransactionId;
    if (payment.status === event.status && sameTransaction) return payment;
    throw new Error('Webhook status conflicts with the payment final state');
  }
  const updated = await paymentRepository.update(payment.id, { status: event.status, upiTransactionId: event.transactionId || payment.upiTransactionId, resolvedAt: new Date() });
  await auditLogService.record({ entityType: 'PaymentRecord', entityId: updated.id, action: `UPI_PAYMENT_${event.status}`, afterState: { status: updated.status, transactionIdPresent: Boolean(updated.upiTransactionId) } });
  return updated;
}

module.exports = { setUpiClient, calculateAmount, createPendingPayment, generateUpiLink, markCashCollected, handleWebhook };
