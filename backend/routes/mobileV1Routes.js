const express = require('express');
const controller = require('../controllers/mobileAuthController');
const assignmentController = require('../controllers/mobileAssignmentController');
const operationsController = require('../controllers/mobileOperationsController');
const { authenticateMobile, requireMobileApp, requireMobileRole } = require('../middleware/mobileAuth');

const router = express.Router();

router.post('/pilot/auth/login', controller.login('PILOT_FIELD'));
router.post('/operations/auth/login', controller.login('OPERATIONS'));
router.post('/operations/auth/farmer/request-otp', controller.requestFarmerOtp);
router.post('/operations/auth/farmer/verify-otp', controller.verifyFarmerOtp);
router.post('/operations/auth/business/login', controller.businessLogin);
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


// Phase 6B: Admin Operational Routes mapped from existing controllers
const userController = require('../controllers/userController');
const droneController = require('../controllers/droneController');
const lmvController = require('../controllers/lmvController');

router.get('/operations/admin/users', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN'), userController.getAllUsers);
router.post('/operations/admin/users', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), userController.addUser);
router.patch('/operations/admin/users/:id', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), userController.updateUser);
router.patch('/operations/admin/users/:id/operating-center', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), userController.updatePilotOperatingCenter);

router.get('/operations/admin/drones', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), droneController.getAllDrones);
router.post('/operations/admin/drones', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN'), droneController.addDrone);
router.patch('/operations/admin/drones/:id', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN'), droneController.updateDrone);

router.get('/operations/admin/lmvs', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN', 'FLEET_MANAGER'), lmvController.getAllLmvs);
router.post('/operations/admin/lmvs', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN'), lmvController.addLmv);
router.patch('/operations/admin/lmvs/:id', requireMobileApp('OPERATIONS'), requireMobileRole('ADMIN'), lmvController.updateLmv);

module.exports = router;
