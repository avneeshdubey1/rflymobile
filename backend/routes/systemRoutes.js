const express = require("express");
const router = express.Router();
const systemController = require("../controllers/systemController");
const { authenticate, authorize } = require('../middleware/auth');

router.post('/seed', authenticate, authorize('ADMIN'), systemController.seedData);

module.exports = router;
