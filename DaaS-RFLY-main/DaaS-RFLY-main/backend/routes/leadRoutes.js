const express = require("express");
const router = express.Router();
const { createLead, getPendingLeads, processLead, getAllLeads } = require("../controllers/leadController");

router.post("/new", createLead);
router.get("/all", getAllLeads);
router.get("/pending", getPendingLeads);
router.post("/process", processLead);

module.exports = router;
