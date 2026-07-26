const express = require("express");
const router = express.Router();
const { getPendingLeads, processLead, getAllLeads } = require("../controllers/leadController");
const intakeController = require('../controllers/intakeController');
const autoAssignmentController = require('../controllers/autoAssignmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/new', authenticate, authorize('FARMER'), intakeController.farmer);
router.post('/ingest/website', intakeController.website);
router.post('/ingest/manual', authenticate, authorize('SALES', 'ADMIN'), intakeController.manual);
router.get("/all", authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), getAllLeads);
router.get("/pending", authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), getPendingLeads);
router.post("/process", authenticate, authorize('SALES', 'ADMIN'), processLead);
router.post('/:leadId/auto-assign', authenticate, authorize('FLEET_MANAGER', 'ADMIN'), autoAssignmentController.assign);

module.exports = router;
