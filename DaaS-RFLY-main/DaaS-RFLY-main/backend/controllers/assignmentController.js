const fs = require('fs');
const path = require('path');

const assignsPath = path.join(__dirname, '../data/assignments.json');
const dronesPath = path.join(__dirname, '../data/drones.json');

// 14-07-26
const usersPath = path.join(__dirname, "../data/users.json");
const leadsPath = path.join(__dirname, "../data/leads.json");

const getUsers = () =>
    JSON.parse(fs.readFileSync(usersPath, "utf8"));

const getLeads = () =>
    JSON.parse(fs.readFileSync(leadsPath, "utf8"));

const saveLeads = (data) =>
    fs.writeFileSync(leadsPath, JSON.stringify(data, null, 2));
// 14-07-26

const getAssignments = () => JSON.parse(fs.readFileSync(assignsPath, 'utf8'));
const saveAssignments = (data) => fs.writeFileSync(assignsPath, JSON.stringify(data, null, 2));

const getDrones = () => JSON.parse(fs.readFileSync(dronesPath, 'utf8'));
const saveDrones = (data) => fs.writeFileSync(dronesPath, JSON.stringify(data, null, 2));

exports.createManualAssignment = (req, res) => {
    try {
        const { lead, pilot, droneId } = req.body;
        const assignments = getAssignments();

        const newAssignment = {
            id: 'ASN-' + Date.now().toString(),
            leadId: lead.id,
            farmerName: lead.farmerName,
            village: lead.village,
            cropType: lead.cropType,
            acres: lead.acres,
            phone: lead.phone,
            pilotEmail: pilot.id,
            droneId: droneId,
            status: 'in_progress', // Forced assignment, skips pending_acceptance
            discrepancyFlag: null,
            createdAt: new Date().toISOString()
        };

        assignments.push(newAssignment);
        saveAssignments(assignments);

        // Update Drone Status
        const drones = getDrones();
        const dIdx = drones.findIndex(d => d.id === droneId);
        if (dIdx !== -1) {
            drones[dIdx].status = `Dispatched with Pilot: ${pilot.id}`;
            saveDrones(drones);
        }

        // Also update lead status from 'processed_waiting_dispatch' to 'dispatched'
        const leadsPath = path.join(__dirname, '../data/leads.json');
        let leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
        const leadIdx = leads.findIndex(l => l.id === lead.id);
        if (leadIdx !== -1) {
            leads[leadIdx].status = 'dispatched';
            fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
        }

        res.status(201).json({ success: true, mission: newAssignment });
    } catch (error) {
        console.error("Error creating manual assignment", error);
        res.status(500).json({ success: false, message: "Failed to dispatch mission" });
    }
};

exports.getPilotMissions = (req, res) => {
    try {
        const { email } = req.query; // e.g. pilot@rfly.com
        const assignments = getAssignments();
        const myMissions = assignments.filter(a => a.pilotEmail === email);
        res.status(200).json({ success: true, missions: myMissions });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch missions" });
    }
};

exports.getAllAssignments = (req, res) => {
    // For Admin/Sales dashboard to see flagged missions
    try {
        res.status(200).json({ success: true, missions: getAssignments() });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch all missions" });
    }
};

exports.updateMissionStatus = (req, res) => {
    try {
        const { id, status, issueType } = req.body;
        const assignments = getAssignments();
        const idx = assignments.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: "Mission not found" });

        assignments[idx].status = status;

        if (status === 'issue_reported') {
            assignments[idx].issue = issueType;
            // Admin needs to review it now. We don't automatically set drone to maintenance yet.
        }

        saveAssignments(assignments);
        res.status(200).json({ success: true, mission: assignments[idx] });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};

exports.rescheduleAssignment = (req, res) => {
    try {
        const { id } = req.params;
        const { expectedSpraying } = req.body; // Using expectedSpraying as the timing string for now
        const assignments = getAssignments();
        const idx = assignments.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: "Mission not found" });

        assignments[idx].expectedSpraying = expectedSpraying;
        assignments[idx].rescheduled = true;

        saveAssignments(assignments);

        // Emit socket event if io is available
        const io = req.app.get('io');
        if (io) {
            io.emit('assignment_rescheduled', assignments[idx]);
        }

        res.status(200).json({ success: true, mission: assignments[idx] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to reschedule" });
    }
};

exports.resolveAlert = (req, res) => {
    try {
        const { id } = req.body;
        const assignments = getAssignments();
        const idx = assignments.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: "Mission not found" });

        const mission = assignments[idx];

        // If it was a drone issue, resolving it means we accept the suggested swap
        if (mission.status === 'issue_reported') {
            mission.droneId = mission.suggestedSwap;
            mission.status = 'in_progress';
            mission.issue = null;
            mission.suggestedSwap = null;
        }

        // If it was a cost discrepancy, resolving it means Admin overrides and accepts it
        if (mission.discrepancyFlag === 'High') {
            mission.discrepancyFlag = 'Resolved';
            mission.finalCost = (mission.pilotEnteredAcres * 500); // Admin approved pilot's claim
        }

        saveAssignments(assignments);
        res.status(200).json({ success: true, mission });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to resolve alert" });
    }
};

exports.completeMission = (req, res) => {
    try {
        const { id, enteredAcres } = req.body;
        const assignments = getAssignments();
        const idx = assignments.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: "Mission not found" });

        const mission = assignments[idx];
        const manualAcres = parseFloat(enteredAcres);

        // --- COST VERIFICATION ENGINE (Simulated Match) ---
        // For development/testing phase, we assume the GPS logger exactly matches the pilot's claim.
        const mockDcsAcres = manualAcres;

        mission.status = 'completed';
        mission.pilotEnteredAcres = manualAcres;
        mission.dcsLoggedAcres = mockDcsAcres;
        mission.discrepancyPercent = "0.00";
        mission.discrepancyFlag = 'None';
        mission.finalCost = (manualAcres * 500); // 500 Rupees/Acre mock cost

        saveAssignments(assignments);

        // Also update the lead status to 'completed'
        const leadsPath = path.join(__dirname, '../data/leads.json');
        let leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
        const leadIdx = leads.findIndex(l => l.id === mission.leadId);
        if (leadIdx !== -1) {
            leads[leadIdx].status = 'completed';
            fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
        }

        res.status(200).json({ success: true, mission });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to complete mission" });
    }
};


// 14-07-26
exports.autoAssignPilot = (req, res) => {
    try {

        const { farmerId } = req.params;

        const leads = getLeads();
        const assignments = getAssignments();
        const drones = getDrones();
        const users = getUsers();

        const farmer = leads.find(l => l.id == farmerId);

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: "Farmer not found"
            });
        }

        // Get all active pilots
        const pilots = users.filter(
            u => u.role === "pilot" && u.isActive
        );

        // Sort pilots by number of active assignments
        pilots.sort((a, b) => {

            const aJobs = assignments.filter(
                x => x.pilotEmail === a.id && x.status !== "completed"
            ).length;

            const bJobs = assignments.filter(
                x => x.pilotEmail === b.id && x.status !== "completed"
            ).length;

            return aJobs - bJobs;
        });

        // Select the pilot with the fewest active jobs
        const pilot = pilots[0];

        const drone = drones.find(d => {

            if (d.status !== "Standby")
                return false;
            const busy = assignments.some(a =>
                a.droneId === d.id &&
                a.expectedDate === farmer.expectedDate &&
                a.expectedTime === farmer.expectedTime &&
                a.status !== "completed"
            );
            return !busy;
        });

        if (!drone) {
            return res.json({
                success: false,
                message: "No Drone Available"
            });
        }

        const assignment = {
            id: "ASN-" + Date.now(),
            leadId: farmer.id,
            farmerName: farmer.farmerName,
            village: farmer.village,
            cropType: farmer.cropType,
            acres: farmer.acres,
            phone: farmer.phone,
            pilotEmail: pilot.id,
            droneId: drone.id,
            expectedDate: farmer.expectedDate,
            expectedTime: farmer.expectedTime,
            status: "in_progress",
            createdAt: new Date().toISOString()
        };

        assignments.push(assignment);
        saveAssignments(assignments);
        drone.status = `Dispatched with Pilot: ${pilot.id}`;
        saveDrones(drones);
        farmer.status = "dispatched";
        saveLeads(leads);
        res.json({
            success: true,
            message: "Pilot Assigned Automatically",
            assignment
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: "Assignment Failed"
        });
    }
};