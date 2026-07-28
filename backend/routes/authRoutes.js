const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const businessAuthController = require('../controllers/businessAuthController');
const recoveryController = require('../controllers/recoveryController');
const { authenticate } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/farmer/request-otp', authController.requestFarmerOtp);
router.post('/farmer/resend-otp', authController.resendFarmerOtp);
router.post('/farmer/login', authController.farmerLogin);
router.post('/farmer/complete-signup', authController.completeFarmerSignup);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

router.post('/recovery/request', recoveryController.request);
router.post('/recovery/complete', recoveryController.complete);

router.post('/business/login', businessAuthController.businessLogin);
router.post('/business/register', businessAuthController.registerBusiness);
router.post('/business/recovery/request-otp', businessAuthController.requestRecoveryOtp);
router.post('/business/recovery/complete', businessAuthController.completeRecovery);

module.exports = router;
