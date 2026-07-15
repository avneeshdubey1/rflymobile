const fs = require('fs');
const path = require('path');

const leadsPath = path.join(__dirname, '../data/leads.json');
const assignsPath = path.join(__dirname, '../data/assignments.json');
const dronesPath = path.join(__dirname, '../data/drones.json');
const usersPath = path.join(__dirname, '../data/users.json');

const checkPassword = (req, res) => {
    if (req.body.password !== 'flushit>') {
        res.status(403).json({ success: false, message: 'Forbidden: Invalid flush password' });
        return false;
    }
    return true;
};

// Purge Functions
exports.purgeLeads = (req, res) => {
    if (!checkPassword(req, res)) return;
    fs.writeFileSync(leadsPath, JSON.stringify([], null, 2));
    res.status(200).json({ success: true, message: 'Leads purged' });
};

exports.purgeAssignments = (req, res) => {
    if (!checkPassword(req, res)) return;
    fs.writeFileSync(assignsPath, JSON.stringify([], null, 2));
    res.status(200).json({ success: true, message: 'Assignments purged' });
};

exports.purgeDrones = (req, res) => {
    if (!checkPassword(req, res)) return;
    fs.writeFileSync(dronesPath, JSON.stringify([], null, 2));
    res.status(200).json({ success: true, message: 'Drones purged' });
};

exports.purgeUsers = (req, res) => {
    if (!checkPassword(req, res)) return;
    // Keep admin, sales, and fleet manager, purge normal pilots
    let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    users = users.filter(u => u.id === '10001' || u.id === '40001' || u.id === '40002' || u.id === '60001');
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    res.status(200).json({ success: true, message: 'Users purged (kept default staff)' });
};

// Populate Functions
exports.populateDrones = (req, res) => {
    if (!checkPassword(req, res)) return;
    const drones = [];
    for (let i = 1; i <= 27; i++) {
        drones.push({
            id: `DRN-${i.toString().padStart(3, '0')}`,
            model: 'Agras T40',
            status: 'Standby'
        });
    }
    fs.writeFileSync(dronesPath, JSON.stringify(drones, null, 2));
    res.status(200).json({ success: true, message: '27 Drones populated' });
};

exports.populateUsers = (req, res) => {
    if (!checkPassword(req, res)) return;
    let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    // Ensure default staff exist
    const defaultStaff = [
        { id: "10001", password: "password123", role: "admin", name: "System Admin" },
        { id: "40001", password: "password123", role: "sales", name: "Sales Rep 1" },
        { id: "40002", password: "password123", role: "sales", name: "Sales Rep 2" },
        { id: "60001", password: "password123", role: "fleet-manager", name: "Fleet Manager", isActive: true }
    ];
    
    // Add 9 pilots
    const pilots = [];
    const pilotNames = ["Suresh Reddy", "Amit Singh", "Vijay Varma", "Rahul Sharma", "Kiran Patel", "Deepak Rao", "Manoj Tiwari", "Vikram Rathore", "Prakash Jha"];
    for (let i = 2; i <= 10; i++) {
        pilots.push({
            id: `6000${i}`,
            password: "password123",
            role: "pilot",
            name: `${pilotNames[i-2]} (Pilot)`,
            isActive: true
        });
    }
    
    users = [...defaultStaff, ...pilots];
    // filter dupes by id
    users = users.filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i);

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    res.status(200).json({ success: true, message: '9 Pilots populated' });
};

// Original generic endpoints for backward compatibility or simple flush all
exports.flushData = (req, res) => {
    if (!checkPassword(req, res)) return;
    this.purgeLeads(req, res);
    this.purgeAssignments(req, res);
    this.purgeDrones(req, res);
};

exports.seedData = (req, res) => {
    if (!checkPassword(req, res)) return;
    res.status(200).json({ success: true, message: 'Use specific populate endpoints instead' });
};
