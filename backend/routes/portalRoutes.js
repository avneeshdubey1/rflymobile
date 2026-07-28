const express = require('express');
const portalController = require('../controllers/portalController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/farmer/summary', authenticate, authorize('FARMER'), portalController.farmerSummary);
router.get('/business/summary', authenticate, authorize('BUSINESS'), portalController.businessSummary);

module.exports = router;
