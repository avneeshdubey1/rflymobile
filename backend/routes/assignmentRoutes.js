const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/pilot', authenticate, authorize('PILOT', 'ADMIN', 'FLEET_MANAGER'), assignmentController.getPilotMissions);
router.get('/all', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), assignmentController.getAllAssignments);
router.get('/sales-alerts', authenticate, authorize('ADMIN', 'SALES'), assignmentController.getSalesAlerts);
router.post('/manual', authenticate, authorize('FLEET_MANAGER', 'ADMIN'), assignmentController.createManualAssignment);
router.put('/:id/reschedule', authenticate, authorize('FLEET_MANAGER', 'ADMIN'), assignmentController.rescheduleAssignment);
router.patch('/:id/sequence', authenticate, authorize('FLEET_MANAGER', 'ADMIN'), assignmentController.resequenceAssignment);
router.get('/:id/eligible-copilots', authenticate, authorize('PILOT'), assignmentController.getEligibleCopilots);
router.post('/:id/copilot', authenticate, authorize('PILOT'), assignmentController.selectCopilot);
router.post('/:id/accept', authenticate, authorize('PILOT'), assignmentController.acceptMission);
router.post('/:id/start', authenticate, authorize('PILOT'), assignmentController.startMission);
router.post('/:id/complete', authenticate, authorize('PILOT'), assignmentController.completeMission);
router.post('/:id/decommission', authenticate, authorize('PILOT'), assignmentController.decommissionMission);
router.post('/:id/location', authenticate, authorize('PILOT'), assignmentController.recordLocation);
router.get('/:id/location', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), assignmentController.getLocation);

router.post('/auto-assign', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), assignmentController.autoAssignPilot);

module.exports = router;
