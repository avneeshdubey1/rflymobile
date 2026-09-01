const assignmentRepository = require('../src/repositories/assignmentRepository');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const missionStateService = require('../services/missionStateService');
const whatsappService = require('../services/whatsappService');
const logger = require('../services/loggerService');
const locationService = require('../services/locationService');
const autoAssignmentService = require('../services/autoAssignmentService');
const autoAssignmentPolicyService = require('../services/autoAssignmentPolicyService');
const crewFormationRepository = require('../src/repositories/crewFormationRepository');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function crewFormationError(res, error) {
    const statusByCode = {
        ASSIGNMENT_NOT_FOUND: 404,
        PRIMARY_PILOT_REQUIRED: 403,
        ASSIGNMENT_REVISION_REQUIRED: 400,
        CREW_FORMATION_RETRY_EXHAUSTED: 503,
    };
    const status = statusByCode[error.code]
        || (String(error.code || '').startsWith('COPILOT_')
            || ['ASSIGNMENT_REVISION_CONFLICT', 'CREW_FORMATION_NOT_PENDING', 'LEGACY_CREW_REVIEW_REQUIRED'].includes(error.code)
            ? 409
            : 400);
    return res.status(status).json({
        success: false,
        code: error.code || 'CREW_FORMATION_FAILED',
        error: status >= 500 ? 'Unable to complete the crew request' : (error.message || 'Crew request failed'),
        ...(error.details ? { details: error.details } : {}),
    });
}

exports.getEligibleCopilots = async(req, res) => {
    try {
        if (!UUID_PATTERN.test(String(req.params.id || ''))) {
            return res.status(400).json({ success: false, code: 'VALIDATION_FAILED', error: 'Assignment identifier is invalid' });
        }
        const candidates = await crewFormationRepository.listEligibleCopilots({
            assignmentId: req.params.id,
            actorId: req.auth.userId,
        });
        return res.json({ success: true, assignmentId: req.params.id, candidates });
    } catch (error) {
        return crewFormationError(res, error);
    }
};

exports.selectCopilot = async(req, res) => {
    try {
        const allowedFields = new Set(['candidateId', 'expectedRevision']);
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
            || Object.keys(req.body).some((field) => !allowedFields.has(field))
            || !UUID_PATTERN.test(String(req.params.id || ''))
            || !UUID_PATTERN.test(String(req.body.candidateId || ''))
            || !Number.isInteger(req.body.expectedRevision)
            || req.body.expectedRevision < 1) {
            return res.status(400).json({ success: false, code: 'VALIDATION_FAILED', error: 'Candidate and current assignment revision are required' });
        }
        const mission = await crewFormationRepository.selectCopilot({
            assignmentId: req.params.id,
            candidateId: req.body.candidateId,
            actorId: req.auth.userId,
            expectedRevision: req.body.expectedRevision,
        });
        return res.json({ success: true, mission });
    } catch (error) {
        return crewFormationError(res, error);
    }
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
        const droneId = req.body.droneId;
        const lmvId = req.body.lmvId;
        const requestedCopilotId = String(req.body.copilotId || '').trim() || null;
        if (req.auth.role !== 'ADMIN' && requestedCopilotId) {
            return res.status(403).json({ error: 'Fleet schedules the Primary Pilot; the Primary Pilot selects the Copilot in the Pilot app' });
        }
        if (!pilotId || !droneId || !lmvId) {
            return res.status(400).json({ error: 'A valid primary Pilot, drone, and LMV are required' });
        }
        const serviceWindowStart = new Date(req.body.serviceWindowStart || req.body.scheduledDate || Date.now());
        const policy = await autoAssignmentPolicyService.getPolicy();
        const serviceWindowEnd = req.body.serviceWindowEnd
            ? new Date(req.body.serviceWindowEnd)
            : new Date(serviceWindowStart.getTime() + policy.defaultJobDurationMinutes * 60_000);
        if (Number.isNaN(serviceWindowStart.valueOf()) || Number.isNaN(serviceWindowEnd.valueOf())) return res.status(400).json({ error: 'Valid service window values are required' });
        const result = await assignmentOperationRepository.manualAssign({
            leadId, pilotId, copilotId: req.auth.role === 'ADMIN' ? requestedCopilotId : null,
            adminCopilotOverride: req.auth.role === 'ADMIN' && Boolean(requestedCopilotId),
            droneId, lmvId, serviceWindowStart, serviceWindowEnd, actorId: req.auth.userId,
        });
        await deliverAfterCommit(
            () => whatsappService.sendMissionScheduled(result.lead, result.assignment.scheduledDate),
            { assignmentId: result.assignment.id, action: 'MISSION_SCHEDULED' },
        );
        res.status(201).json({ success: true, mission: result.assignment });
    } catch (error) {
        if (String(error.code || '').startsWith('SERVICE_AREA_')) return res.status(409).json({ code: error.code });
        return res.status(['CONFLICT', 'SCHEDULING_RETRY_EXHAUSTED', 'COPILOT_SELECTION_WINDOW_CLOSED'].includes(error.code) ? 409 : 400).json({
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
        const requestedCopilotId = String(req.body.copilotId || '').trim() || null;
        if (req.auth.role !== 'ADMIN' && requestedCopilotId) {
            return res.status(403).json({ error: 'Only Admin may assign or override a Copilot. Fleet schedules the Primary Pilot and the Primary Pilot selects the Copilot in the Pilot app.' });
        }
        if (Number.isNaN(serviceWindowStart.valueOf()) || (serviceWindowEnd && Number.isNaN(serviceWindowEnd.valueOf()))) {
            return res.status(400).json({ error: 'Valid service window values are required' });
        }
        if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A reschedule reason between 3 and 500 characters is required' });
        const result = await assignmentOperationRepository.reschedule({
            assignmentId: req.params.id,
            serviceWindowStart,
            serviceWindowEnd,
            pilotId: req.body.pilotId,
            copilotId: req.auth.role === 'ADMIN' ? requestedCopilotId : null,
            adminCopilotOverride: req.auth.role === 'ADMIN' && Boolean(requestedCopilotId),
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
        return res.status(error.code === 'NOT_FOUND' ? 404 : ['CONFLICT', 'SCHEDULING_RETRY_EXHAUSTED', 'COPILOT_SELECTION_WINDOW_CLOSED'].includes(error.code) ? 409 : 400).json({
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
