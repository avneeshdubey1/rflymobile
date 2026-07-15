const express = require("express");
const router = express.Router();
const bhumeetController = require('../controllers/bhumeetController');

router.use("/", bhumeetController.proxyRequest);

module.exports = router;
