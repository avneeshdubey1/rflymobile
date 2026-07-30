const express = require('express');
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/sales', authenticate, authorize('SALES', 'ADMIN'), customerController.search);
router.post('/sales', authenticate, authorize('SALES', 'ADMIN'), customerController.create);
router.patch('/sales/:customerId', authenticate, authorize('SALES', 'ADMIN'), customerController.update);
router.get('/sales/:customerId/service-context', authenticate, authorize('SALES', 'ADMIN'), customerController.serviceContext);
router.post('/sales/:customerId/portal-access', authenticate, authorize('SALES', 'ADMIN'), customerController.enablePortalAccess);
router.post('/sales/:customerId/leads', authenticate, authorize('SALES', 'ADMIN'), customerController.createLeadForCustomer);

module.exports = router;
