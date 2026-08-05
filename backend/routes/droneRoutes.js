const express = require("express");
const router = express.Router();
const droneController = require('../controllers/droneController');
const { authenticate, authorize } = require('../middleware/auth');

router.get("/active", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.getActiveDrones);
router.get("/all", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.getAllDrones);
router.post("/add", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), droneController.addDrone);

// router.post(
//     "/import",
//     authenticate,
//     authorize("ADMIN", "FLEET_MANAGER"),
//     droneController.importDrones
// );

router.post(
    "/sync",
    authenticate,
    authorize("ADMIN", "FLEET_MANAGER"),
    droneController.syncDrones
);

router.post("/update-status", authenticate, authorize('FLEET_MANAGER', 'ADMIN'), droneController.updateStatus);

router.patch("/:id", authenticate, authorize("ADMIN", "FLEET_MANAGER"), droneController.updateDrone);
router.delete("/:id", authenticate, authorize("ADMIN", "FLEET_MANAGER"), droneController.deleteDrone);

module.exports = router;