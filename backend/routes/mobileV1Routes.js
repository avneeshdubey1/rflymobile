const express = require('express');
const controller = require('../controllers/mobileAuthController');
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
router.get('/operations/bootstrap', requireMobileApp('OPERATIONS'), controller.bootstrap);

module.exports = router;
