const express = require('express');
const router = express.Router();
const lmvController = require('../controllers/lmvController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/available', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.getAvailableLmvs);
router.get('/all', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.getAllLmvs);
router.post('/add', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.addLmv);
router.put('/:id', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.updateLmv);
router.post('/update-status', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.updateStatus);
router.delete('/:id', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), lmvController.deleteLmv);

module.exports = router;
