const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const auditLogController = require('../controllers/auditLogController');

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), auditLogController.getTimeline);

module.exports = router;
