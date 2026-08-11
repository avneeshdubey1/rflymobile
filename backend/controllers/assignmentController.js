const assignmentRepository = require('../src/repositories/assignmentRepository');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const missionStateService = require('../services/missionStateService');
const whatsappService = require('../services/whatsappService');
const logger = require('../services/loggerService');
const locationService = require('../services/locationService');
const autoAssignmentService = require('../services/autoAssignmentService');
const autoAssignmentPolicyService = require('../services/autoAssignmentPolicyService');

async function deliverAfterCommit(deliver, context) {
    try {
        await deliver();
    } catch (error) {
        logger.error('assignment.post_commit_delivery_failed', { ...context, error: error.message });
    }
}

exports.getPilotMissions = async(req, res) => {
    try {
        const pilotId = req.auth && req.auth.role === 'PILOT' ? req.auth.userId : req.query.pilotId;
        if (!pilotId) return res.status(400).json({ error: 'pilotId is required' });
        res.json({ success: true, missions: await assignmentRepository.findAll({ OR: [{ pilotId }, { copilotId: pilotId }] }) });
    } catch { res.status(500).json({ error: 'Failed to fetch missions' }); }
};
exports.getAllAssignments = async(req, res) => {
    try {
        const now = new Date();
        const from = req.query.from ? new Date(req.query.from) : new Date(now.getTime() - 50 * 24 * 60 * 60_000);
        const to = req.query.to ? new Date(req.query.to) : new Date(now.getTime() + 50 * 24 * 60 * 60_000);
        if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || to <= from) {
            return res.status(400).json({ error: 'Valid from and to date bounds are required' });
        }
        if (to.getTime() - from.getTime() > 100 * 24 * 60 * 60_000) {
            return res.status(400).json({ error: 'Assignment date range cannot exceed 100 days' });
        }
        return res.json({
            success: true,
            missions: await assignmentRepository.findAll({
                OR: [
                    { serviceWindowStart: { lt: to }, serviceWindowEnd: { gt: from } },
                    {
                        serviceWindowStart: null,
                        scheduledDate: { gte: new Date(from.getTime() - 12 * 60 * 60_000), lt: to },
                    },
                ],
            }),
        });
    } catch {
        return res.status(500).json({ error: 'Failed to fetch assignments' });
    }
};
exports.getSalesAlerts = async(_req, res) => { try { res.json({ success: true, alerts: await assignmentRepository.findSalesAlerts() }); } catch { res.status(500).json({ error: 'Failed to fetch operational alerts' }); } };

exports.createManualAssignment = async(req, res) => {
    try {
        const leadId = req.body.leadId || (req.body.lead && req.body.lead.id);
        const pilotId = req.body.pilotId || (req.body.pilot && req.body.pilot.id);
        const copilotId = req.body.copilotId || (req.body.copilot && req.body.copilot.id);
        const droneId = req.body.droneId;
        const lmvId = req.body.lmvId;
        if (!pilotId || !copilotId || !droneId || !lmvId) {
            return res.status(400).json({ error: 'A valid primary Pilot, Copilot, drone, and LMV are required' });
        }
        const serviceWindowStart = new Date(req.body.serviceWindowStart || req.body.scheduledDate || Date.now());
        const policy = await autoAssignmentPolicyService.getPolicy();
        const serviceWindowEnd = req.body.serviceWindowEnd
            ? new Date(req.body.serviceWindowEnd)
            : new Date(serviceWindowStart.getTime() + policy.defaultJobDurationMinutes * 60_000);
        if (Number.isNaN(serviceWindowStart.valueOf()) || Number.isNaN(serviceWindowEnd.valueOf())) return res.status(400).json({ error: 'Valid service window values are required' });
        const result = await assignmentOperationRepository.manualAssign({
            leadId, pilotId, copilotId, droneId, lmvId, serviceWindowStart, serviceWindowEnd, actorId: req.auth.userId,
        });
        await deliverAfterCommit(
            () => whatsappService.sendMissionScheduled(result.lead, result.assignment.scheduledDate),
            { assignmentId: result.assignment.id, action: 'MISSION_SCHEDULED' },
        );
        res.status(201).json({ success: true, mission: result.assignment });
    } catch (error) {
        if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
        return res.status(['CONFLICT', 'SCHEDULING_RETRY_EXHAUSTED'].includes(error.code) ? 409 : 400).json({
            error: error.message || 'Failed to create assignment', code: error.code, conflictCategories: error.conflictCategories,
        });
    }
};

function stateHandler(action) {
    return async(req, res) => {
        try {
            const actualValue = (req.body.actualAcreage !== undefined && req.body.actualAcreage !== null) ?
                req.body.actualAcreage :
                (req.body.enteredAcres !== undefined && req.body.enteredAcres !== null) ?
                req.body.enteredAcres :
                req.body.reason;
            const result = await missionStateService[action](req.params.id || req.body.id, req.auth.userId, actualValue);
            res.json({ success: true, ...result });
        } catch (error) { res.status(409).json({ error: error.message }); }
    };
}

exports.acceptMission = stateHandler('accept');
exports.startMission = stateHandler('start');
exports.completeMission = stateHandler('complete');
exports.decommissionMission = stateHandler('decommission');

exports.recordLocation = async(req, res) => {
    try {
        const location = await locationService.recordLocation(req.params.id, req.auth, req.body.latitude, req.body.longitude);
        const io = req.app.get('io');
        if (io) io.to(`location:${req.params.id}`).emit('location:update', location);
        res.json({ success: true, location });
    } catch (error) { res.status(409).json({ error: error.message || 'Failed to record location' }); }
};

exports.getLocation = async(req, res) => {
    try { res.json({ success: true, location: await locationService.getLocation(req.params.id, req.auth) }); } catch (error) { res.status(409).json({ error: error.message || 'Failed to fetch location' }); }
};

exports.rescheduleAssignment = async(req, res) => {
    try {
        const serviceWindowStart = new Date(req.body.serviceWindowStart || req.body.scheduledDate);
        const serviceWindowEnd = req.body.serviceWindowEnd ? new Date(req.body.serviceWindowEnd) : null;
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (Number.isNaN(serviceWindowStart.valueOf()) || (serviceWindowEnd && Number.isNaN(serviceWindowEnd.valueOf()))) {
            return res.status(400).json({ error: 'Valid service window values are required' });
        }
        if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A reschedule reason between 3 and 500 characters is required' });
        const result = await assignmentOperationRepository.reschedule({
            assignmentId: req.params.id,
            serviceWindowStart,
            serviceWindowEnd,
            pilotId: req.body.pilotId,
            copilotId: req.body.copilotId,
            droneId: req.body.droneId,
            lmvId: req.body.lmvId,
            actorId: req.auth.userId,
            reason,
        });
        await deliverAfterCommit(
            () => whatsappService.sendMissionScheduled(result.lead, result.assignment.scheduledDate),
            { assignmentId: result.assignment.id, action: 'MISSION_RESCHEDULED' },
        );
        res.json({ success: true, mission: result.assignment, lead: result.lead });
    } catch (error) {
        if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
        return res.status(error.code === 'NOT_FOUND' ? 404 : ['CONFLICT', 'SCHEDULING_RETRY_EXHAUSTED'].includes(error.code) ? 409 : 400).json({
            error: error.message || 'Failed to reschedule assignment', code: error.code, conflictCategories: error.conflictCategories,
        });
    }
};

exports.resequenceAssignment = async(req, res) => {
    try {
        const sequence = Number(req.body.dailySequence);
        if (!Number.isInteger(sequence) || sequence < 1) return res.status(400).json({ error: 'dailySequence must be a positive whole number' });
        const assignment = await assignmentOperationRepository.resequence({ assignmentId: req.params.id, dailySequence: sequence, actorId: req.auth.userId });
        return res.json({ success: true, mission: assignment });
    } catch (error) {
        return res.status(error.code === 'NOT_FOUND' ? 404 : 400).json({ error: error.message || 'Failed to reorder assignment' });
    }
};

exports.autoAssignPilot = async(req, res) => {
    try {
        const leadId = req.body.leadId || (req.body.lead && req.body.lead.id);
        if (!leadId) return res.status(400).json({ error: 'A valid lead is required' });
        const requestedDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : new Date();
        if (Number.isNaN(requestedDate.valueOf())) return res.status(400).json({ error: 'Valid scheduledDate is required' });

        const result = await autoAssignmentService.autoAssignProcessedLead(leadId, { now: requestedDate, actorId: req.auth.userId, trigger: 'OPERATOR_RETRY' });
        if (result.outcome !== 'SCHEDULED') {
            return res.status(409).json({
                success: false,
                outcome: result.outcome,
                error: result.reason || 'The Lead could not be automatically assigned',
            });
        }
        return res.status(201).json({ success: true, outcome: result.outcome, mission: result.assignment, lead: result.lead });
    } catch (error) {
        if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
        return res.status(400).json({ error: error.message || 'Auto-assignment failed' });
    }
};
