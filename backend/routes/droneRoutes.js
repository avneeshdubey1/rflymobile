const express = require("express");
const router = express.Router();
const droneController = require('../controllers/droneController');
const { authenticate, authorize } = require('../middleware/auth');

router.get("/active", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.getActiveDrones);
router.get("/all", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.getAllDrones);
router.post("/add", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.addDrone);
router.post("/request-maintenance", authenticate, authorize('FLEET_MANAGER', 'ADMIN'), droneController.requestMaintenance);
router.post("/resolve-maintenance", authenticate, authorize('FLEET_MANAGER', 'ADMIN'), droneController.resolveMaintenance);
router.post("/update-status", authenticate, authorize('FLEET_MANAGER', 'ADMIN'), droneController.updateStatus);
router.post("/inquire", authenticate, authorize('FLEET_MANAGER', 'ADMIN'), droneController.inquire);

module.exports = router;
