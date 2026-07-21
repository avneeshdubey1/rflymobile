const express = require("express");
const router = express.Router();
const centerController = require("../controllers/centerController");
const { authenticate, authorize } = require('../middleware/auth');

router.get("/all", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), centerController.getAllCenters);
router.post("/add", authenticate, authorize('ADMIN'), centerController.addCenter);
router.delete("/delete/:id", authenticate, authorize('ADMIN'), centerController.deleteCenter);

module.exports = router;
