const express = require('express');
const { googleForm } = require('../controllers/intakeController');
const { verifyGoogleFormWebhook } = require('../middleware/webhookSecurity');

const router = express.Router();
// Target for the Apps Script on-submit webhook described in SPEC.md §5.2.
router.post('/webhook', verifyGoogleFormWebhook, googleForm);

module.exports = router;
