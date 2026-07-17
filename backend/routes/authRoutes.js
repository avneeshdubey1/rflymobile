const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/farmer/login', authController.farmerLogin);
router.post('/farmer/complete-signup', authController.completeFarmerSignup);

module.exports = router;
