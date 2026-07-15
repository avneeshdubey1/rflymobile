const express = require("express");
const router = express.Router();
const {
    getPilotMissions,
    updateMissionStatus,
    completeMission,
    getAllAssignments,
    createManualAssignment,
    resolveAlert,
    rescheduleAssignment,
    autoAssignPilot // new 14-07-26
} = require("../controllers/assignmentController");

router.get("/pilot", getPilotMissions);
router.get("/all", getAllAssignments);
router.post("/status", updateMissionStatus);
router.post("/complete", completeMission);
router.post("/manual", createManualAssignment);
router.post("/resolve", resolveAlert);
router.put("/:id/reschedule", rescheduleAssignment);
// Assign pilot 14-07-26
router.post("/auto-assign/:farmerId", autoAssignPilot);

module.exports = router;