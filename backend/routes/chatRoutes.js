const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'FLEET_MANAGER', 'SALES', 'PILOT'));
router.get('/participants', chatController.getParticipants);
router.get('/sessions', chatController.getSessions);
router.post('/sessions', chatController.createSession);
router.get('/sessions/:id/messages', chatController.getMessages);
router.post('/sessions/:id/read', chatController.markRead);
router.post('/sessions/:id/close', chatController.closeSession);

module.exports = router;
