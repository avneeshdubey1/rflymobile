const express = require("express");
const router = express.Router();
const { createLead, getPendingLeads, processLead, getAllLeads } = require("../controllers/leadController");
const intakeController = require('../controllers/intakeController');
const appealController = require('../controllers/appealController');
const autoAssignmentController = require('../controllers/autoAssignmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { verifyGoogleFormWebhook } = require('../middleware/webhookSecurity');

router.post("/new", intakeController.website);
router.post('/ingest/website', intakeController.website);
router.post('/ingest/google-form', verifyGoogleFormWebhook, intakeController.googleForm);
router.post('/ingest/manual', authenticate, authorize('SALES', 'ADMIN'), intakeController.manual);
router.get("/all", authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), getAllLeads);
router.get("/pending", authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), getPendingLeads);
router.post("/process", authenticate, authorize('SALES', 'ADMIN'), processLead);
router.post('/:leadId/appeal', appealController.create);
router.post('/:leadId/appeal/review', authenticate, authorize('SALES', 'ADMIN'), appealController.review);
router.post('/:leadId/auto-assign', authenticate, authorize('FLEET_MANAGER', 'ADMIN'), autoAssignmentController.assign);

module.exports = router;
