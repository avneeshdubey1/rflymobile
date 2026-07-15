const paymentRepository = require('../src/repositories/paymentRepository');
const paymentService = require('../services/paymentService');

function respondError(res, error) {
  const status = /not found/.test(error.message) ? 404 : /Only pending|Webhook status/.test(error.message) ? 409 : 400;
  return res.status(status).json({ error: error.message });
}

exports.getPending = async (_req, res) => {
  try { return res.json({ success: true, payments: await paymentRepository.findPending() }); }
  catch (error) { return respondError(res, error); }
};

exports.generateLink = async (req, res) => {
  try { return res.json({ success: true, ...(await paymentService.generateUpiLink(req.params.assignmentId)) }); }
  catch (error) { return respondError(res, error); }
};

exports.markCash = async (req, res) => {
  try { return res.json({ success: true, payment: await paymentService.markCashCollected(req.params.id, req.auth.userId) }); }
  catch (error) { return respondError(res, error); }
};

exports.webhook = async (req, res) => {
  try { return res.json({ success: true, payment: await paymentService.handleWebhook(req.params.id, req.body) }); }
  catch (error) { return respondError(res, error); }
};
