const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../data/users.json');

const getUsers = () => JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const saveUsers = (data) => fs.writeFileSync(usersPath, JSON.stringify(data, null, 2));

exports.getAllUsers = (req, res) => {
    try {
        res.status(200).json({ success: true, users: getUsers() });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
};

exports.addUser = (req, res) => {
    try {
        const { email, password, role, name } = req.body;
        const users = getUsers();
        
        // Check if exists
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const newUser = {
            id: Date.now(),
            email,
            password,
            role,
            name
        };
        
        users.push(newUser);
        saveUsers(users);
        res.status(201).json({ success: true, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add user" });
    }
};

exports.deleteUser = (req, res) => {
    try {
        const { id } = req.params;
        let users = getUsers();
        users = users.filter(u => u.id.toString() !== id.toString());
        saveUsers(users);
        res.status(200).json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete user" });
    }
};

exports.editPassword = (req, res) => {
    try {
        const { id, newPassword } = req.body;
        let users = getUsers();
        const idx = users.findIndex(u => u.id.toString() === id.toString());
        if (idx === -1) return res.status(404).json({ success: false, message: "User not found" });

        users[idx].password = newPassword;
        saveUsers(users);
        res.status(200).json({ success: true, message: "Password updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to edit password" });
    }
};

exports.toggleActive = (req, res) => {
    try {
        const { id, isActive } = req.body;
        let users = getUsers();
        const idx = users.findIndex(u => u.id.toString() === id.toString());
        if (idx === -1) return res.status(404).json({ success: false, message: "User not found" });

        users[idx].isActive = isActive;
        saveUsers(users);
        res.status(200).json({ success: true, user: users[idx] });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to toggle status" });
    }
};
