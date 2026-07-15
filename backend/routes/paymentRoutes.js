const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { protectAgainstReplay, verifyUpiWebhook } = require('../middleware/webhookSecurity');

const router = express.Router();
router.get('/pending', authenticate, authorize('ADMIN', 'SALES'), paymentController.getPending);
router.post('/:assignmentId/generate-link', authenticate, authorize('ADMIN', 'SALES'), paymentController.generateLink);
router.post('/:id/mark-cash', authenticate, authorize('ADMIN', 'SALES'), paymentController.markCash);
router.post('/:id/webhook', verifyUpiWebhook, protectAgainstReplay('upi'), paymentController.webhook);

module.exports = router;
