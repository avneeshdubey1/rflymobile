const express = require('express');
const controller = require('../controllers/masterDataController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.get('/choices', authenticate, authorize('ADMIN', 'SALES', 'FLEET_MANAGER'), controller.choices);
router.get('/admin', authenticate, authorize('ADMIN'), controller.listAdmin);
router.post('/clusters', authenticate, authorize('ADMIN'), controller.createCluster);
router.patch('/clusters/:id', authenticate, authorize('ADMIN'), controller.updateCluster);
router.post('/values', authenticate, authorize('ADMIN'), controller.createValue);
router.patch('/values/:id', authenticate, authorize('ADMIN'), controller.updateValue);
router.post('/crops', authenticate, authorize('ADMIN'), controller.createCrop);
router.patch('/crops/:id', authenticate, authorize('ADMIN'), controller.updateCrop);
module.exports = router;
