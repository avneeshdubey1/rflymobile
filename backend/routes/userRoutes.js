const express = require("express");
const router = express.Router();
const { getAllUsers, getPilots, addUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get("/pilots", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), getPilots);

// Admin User Management
router.get("/all", authenticate, authorize('ADMIN'), getAllUsers);
router.post("/add", authenticate, authorize('ADMIN'), addUser);
router.delete("/delete/:id", authenticate, authorize('ADMIN'), deleteUser);
router.post("/edit-password", authenticate, authorize('ADMIN'), require('../controllers/userController').editPassword);
router.post("/toggle-active", authenticate, authorize('ADMIN'), require('../controllers/userController').toggleActive);

module.exports = router;
