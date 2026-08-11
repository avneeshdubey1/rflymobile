const express = require('express');
const controller = require('../controllers/autoAssignmentPolicyController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, authorize('ADMIN', 'FLEET_MANAGER', 'SALES'), controller.summary);
router.get('/', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.get);
router.put('/', authenticate, authorize('ADMIN'), controller.update);

module.exports = router;
