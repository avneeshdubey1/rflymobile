const express = require('express');
const controller = require('../controllers/mobileAuthController');
const assignmentController = require('../controllers/mobileAssignmentController');
const operationsController = require('../controllers/mobileOperationsController');
const { authenticateMobile, requireMobileApp, requireMobileRole } = require('../middleware/mobileAuth');

const router = express.Router();

router.post('/pilot/auth/login', controller.login('PILOT_FIELD'));
router.post('/operations/auth/login', controller.login('OPERATIONS'));
router.use(authenticateMobile);
router.post('/auth/logout', controller.logout);
router.post('/auth/logout-all', controller.logoutAll);
router.delete('/installations/:installationId', controller.revokeInstallation);
router.delete('/operations/installations/:installationId', requireMobileApp('OPERATIONS'), controller.adminRevokeInstallation);
router.get('/pilot/bootstrap', requireMobileApp('PILOT_FIELD'), controller.bootstrap);
router.put('/pilot/availability', requireMobileApp('PILOT_FIELD'), controller.updatePilotAvailability);
router.get('/pilot/assignments', requireMobileApp('PILOT_FIELD'), assignmentController.list);
router.get('/pilot/changes', requireMobileApp('PILOT_FIELD'), assignmentController.changes);
router.post('/pilot/sync', requireMobileApp('PILOT_FIELD'), assignmentController.sync);
router.get('/pilot/assignments/:assignmentId', requireMobileApp('PILOT_FIELD'), assignmentController.detail);
router.get('/pilot/assignments/:assignmentId/eligible-copilots', requireMobileApp('PILOT_FIELD'), assignmentController.eligibleCopilots);
router.post('/pilot/assignments/:assignmentId/copilot', requireMobileApp('PILOT_FIELD'), assignmentController.selectCopilot);
router.post('/pilot/assignments/:assignmentId/actions', requireMobileApp('PILOT_FIELD'), assignmentController.mutate);
router.post('/pilot/assignments/:assignmentId/location', requireMobileApp('PILOT_FIELD'), assignmentController.recordLocation);
router.get('/operations/bootstrap', requireMobileApp('OPERATIONS'), controller.bootstrap);
router.get('/operations/sales/customers', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER', 'SALES'), operationsController.searchCustomers);
router.get('/operations/sales/customers/by-phone', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER', 'SALES'), operationsController.findCustomerByPhone);
router.post('/operations/sales/customers', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'SALES'), operationsController.createCustomer);
router.post('/operations/sales/customers/:customerId/leads', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'SALES'), operationsController.createLead);
router.get('/operations/fleet/schedule', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), operationsController.fleetSchedule);
router.get('/operations/fleet/exceptions', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), operationsController.fleetExceptions);
router.post('/operations/assignments/:assignmentId/copilot-override', requireMobileApp('OPERATIONS'), assignmentController.overrideCopilot);

module.exports = router;
