const express = require("express");
const router = express.Router();
const {
    getAllUsers,
    getPilots,
    addUser,
    deleteUser,
    updatePilotOperatingCenter,
    updateUser
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get("/pilots", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), getPilots);

router.get("/preferences", authenticate, require('../controllers/userController').getPreferences);
router.put("/preferences", authenticate, require('../controllers/userController').updatePreferences);

// Admin User Management
router.get("/all", authenticate, authorize('ADMIN'), getAllUsers);
router.post("/add", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), addUser);
router.patch("/:id/operating-center", authenticate, authorize('ADMIN', 'FLEET_MANAGER'), updatePilotOperatingCenter);
router.delete("/delete/:id", authenticate, authorize('ADMIN'), deleteUser);
router.post("/edit-password", authenticate, authorize('ADMIN'), require('../controllers/userController').editPassword);
router.post("/toggle-active", authenticate, authorize('ADMIN'), require('../controllers/userController').toggleActive);
router.patch('/:id', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), updateUser);

module.exports = router;