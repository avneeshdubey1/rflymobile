const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const businessAuthController = require('../controllers/businessAuthController');

router.post('/login', authController.login);
router.post('/farmer/login', authController.farmerLogin);
router.post('/farmer/complete-signup', authController.completeFarmerSignup);

router.post('/business/login', businessAuthController.businessLogin);
router.post('/business/register', businessAuthController.registerBusiness);
router.post('/business/reset-password', businessAuthController.resetPassword);

module.exports = router;
