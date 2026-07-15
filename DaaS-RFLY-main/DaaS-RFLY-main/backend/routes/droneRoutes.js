const express = require("express");
const router = express.Router();
const droneController = require('../controllers/droneController');

router.get("/active", droneController.getActiveDrones);
router.get("/all", droneController.getAllDrones);
router.post("/request-maintenance", droneController.requestMaintenance);
router.post("/resolve-maintenance", droneController.resolveMaintenance);
router.post("/update-status", droneController.updateStatus);
router.post("/inquire", droneController.inquire);

module.exports = router;
