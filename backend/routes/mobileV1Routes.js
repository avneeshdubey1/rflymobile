const express = require('express');
const controller = require('../controllers/mobileAuthController');
const assignmentController = require('../controllers/mobileAssignmentController');
const { authenticateMobile, requireMobileApp } = require('../middleware/mobileAuth');

const router = express.Router();

router.post('/pilot/auth/login', controller.login('PILOT_FIELD'));
router.post('/operations/auth/login', controller.login('OPERATIONS'));
router.use(authenticateMobile);
router.post('/auth/logout', controller.logout);
router.post('/auth/logout-all', controller.logoutAll);
router.delete('/installations/:installationId', controller.revokeInstallation);
router.delete('/operations/installations/:installationId', requireMobileApp('OPERATIONS'), controller.adminRevokeInstallation);
router.get('/pilot/bootstrap', requireMobileApp('PILOT_FIELD'), controller.bootstrap);
router.get('/pilot/assignments', requireMobileApp('PILOT_FIELD'), assignmentController.list);
router.get('/pilot/assignments/:assignmentId', requireMobileApp('PILOT_FIELD'), assignmentController.detail);
router.get('/pilot/assignments/:assignmentId/eligible-copilots', requireMobileApp('PILOT_FIELD'), assignmentController.eligibleCopilots);
router.post('/pilot/assignments/:assignmentId/copilot', requireMobileApp('PILOT_FIELD'), assignmentController.selectCopilot);
router.post('/pilot/assignments/:assignmentId/actions', requireMobileApp('PILOT_FIELD'), assignmentController.mutate);
router.get('/operations/bootstrap', requireMobileApp('OPERATIONS'), controller.bootstrap);
router.post('/operations/assignments/:assignmentId/copilot-override', requireMobileApp('OPERATIONS'), assignmentController.overrideCopilot);

module.exports = router;
