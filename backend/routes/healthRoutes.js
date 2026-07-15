const express = require('express');
const healthController = require('../controllers/healthController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/', healthController.getHealth);
router.get('/details', authenticate, authorize('ADMIN'), healthController.getDetailedHealth);
module.exports = router;
