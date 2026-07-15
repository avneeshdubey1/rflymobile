const express = require("express");
const router = express.Router();

const acreageController = require("../controllers/acreageController");


router.get("/", acreageController.getAcreageTrend);


module.exports = router;