const fs = require('fs');
const path = require('path');

const dronesPath = path.join(__dirname, '../data/drones.json');

const getDrones = () => JSON.parse(fs.readFileSync(dronesPath, 'utf8'));
const saveDrones = (data) => fs.writeFileSync(dronesPath, JSON.stringify(data, null, 2));

exports.getActiveDrones = (req, res) => {
    try {
        const drones = getDrones();
        // Since we changed drone status to "Dispatched with Pilot: 60xxx", we need to include those as well
        // But for assigning, we only want Active or Standby drones that are NOT dispatched.
        const available = drones.filter(d => d.status === 'Active' || d.status === 'Standby');
        res.status(200).json({ success: true, drones: available });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch drones" });
    }
};

exports.getAllDrones = (req, res) => {
    try {
        res.status(200).json({ success: true, drones: getDrones() });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch drones" });
    }
};

exports.requestMaintenance = (req, res) => {
    try {
        const { droneId, pilotId, reason } = req.body;
        let drones = getDrones();
        const dIdx = drones.findIndex(d => d.id === droneId);
        if (dIdx === -1) return res.status(404).json({ success: false, message: "Drone not found" });

        drones[dIdx].maintenanceRequest = {
            requestedBy: pilotId,
            reason: reason,
            status: 'pending'
        };
        saveDrones(drones);
        res.status(200).json({ success: true, message: "Maintenance requested" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to request maintenance" });
    }
};

exports.resolveMaintenance = (req, res) => {
    try {
        const { droneId, action } = req.body; // action: 'approve' | 'reject'
        let drones = getDrones();
        const dIdx = drones.findIndex(d => d.id === droneId);
        if (dIdx === -1) return res.status(404).json({ success: false, message: "Drone not found" });

        if (action === 'approve') {
            drones[dIdx].status = 'Maintenance';
            drones[dIdx].maintenanceRequest = null;
        } else {
            // reject
            drones[dIdx].maintenanceRequest = null;
        }

        saveDrones(drones);
        res.status(200).json({ success: true, message: "Maintenance resolved" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to resolve maintenance" });
    }
};

exports.updateStatus = (req, res) => {
    try {
        const { droneId, status } = req.body;
        let drones = getDrones();
        const dIdx = drones.findIndex(d => d.id === droneId);
        if (dIdx === -1) return res.status(404).json({ success: false, message: "Drone not found" });

        drones[dIdx].status = status;

        // Clear inquiry if they updated status
        if (drones[dIdx].pendingInquiry) {
            drones[dIdx].pendingInquiry = null;
        }

        saveDrones(drones);
        res.status(200).json({ success: true, message: "Drone status updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update drone status" });
    }
};

exports.inquire = (req, res) => {
    try {
        const { droneId } = req.body;
        let drones = getDrones();
        const dIdx = drones.findIndex(d => d.id === droneId);
        if (dIdx === -1) return res.status(404).json({ success: false, message: "Drone not found" });

        drones[dIdx].pendingInquiry = {
            timestamp: new Date().toISOString(),
            message: "Admin requested a status update for this drone."
        };

        saveDrones(drones);
        res.status(200).json({ success: true, message: "Inquiry sent to pilot" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to send inquiry" });
    }
};