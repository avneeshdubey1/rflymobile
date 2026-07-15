const express = require("express");
const router = express.Router();
const acreageController = require("../controllers/acreageController");
const { authenticate } = require('../middleware/auth');

router.get("/", authenticate, acreageController.getAcreageTrend);

module.exports = router;
