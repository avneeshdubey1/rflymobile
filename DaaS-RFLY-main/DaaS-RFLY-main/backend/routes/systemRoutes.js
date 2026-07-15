const express = require("express");
const router = express.Router();
const systemController = require("../controllers/systemController");

router.post("/flush", systemController.flushData);
router.post("/seed", systemController.seedData);
router.post("/purge/leads", systemController.purgeLeads);
router.post("/purge/assignments", systemController.purgeAssignments);
router.post("/purge/drones", systemController.purgeDrones);
router.post("/purge/users", systemController.purgeUsers);
router.post("/populate/drones", systemController.populateDrones);
router.post("/populate/users", systemController.populateUsers);

module.exports = router;
