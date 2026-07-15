const express = require("express");
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getAllUsers, addUser, deleteUser } = require('../controllers/userController');

// Old endpoint used by Sales Dispatch board (could be moved to controller but keeping for compatibility)
router.get("/pilots", (req, res) => {
    try {
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8'));
        const pilots = users.filter(u => u.role === 'pilot');
        res.status(200).json({ success: true, pilots });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch pilots" });
    }
});

// Admin User Management
router.get("/all", getAllUsers);
router.post("/add", addUser);
router.delete("/delete/:id", deleteUser);
router.post("/edit-password", require('../controllers/userController').editPassword);
router.post("/toggle-active", require('../controllers/userController').toggleActive);

module.exports = router;
