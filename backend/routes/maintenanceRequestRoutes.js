const express = require('express');
const controller = require('../controllers/maintenanceRequestController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.list);
router.get('/activity', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.activity);
router.post('/', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.create);
router.post('/:id/accept', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.accept);
router.post('/:id/reject', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.reject);
router.post('/:id/resolve', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), controller.resolve);

module.exports = router;
