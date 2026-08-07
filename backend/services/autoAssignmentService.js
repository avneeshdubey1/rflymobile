const leadRepository = require('../src/repositories/leadRepository');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const weatherService = require('./weatherService');
const whatsappService = require('./whatsappService');
const logger = require('./loggerService');

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

async function moveToManualScheduling(lead, reason, notificationType = 'NEEDS_MANUAL_SCHEDULING', actorId = null) {
    const result = await assignmentOperationRepository.moveToManualScheduling({ leadId: lead.id, reason, notificationType, actorId });
    logger.warn('assignment.manual_scheduling_required', { leadId: lead.id, notificationType, reason });
    return result;
}

async function selectWeatherDate(lead, now) {
    for (let offset = 0; offset < 5; offset += 1) {
        const date = startOfDay(now);
        date.setDate(date.getDate() + offset);
        date.setHours(9, 0, 0, 0);
        const weather = await weatherService.checkSuitability(lead.latitude, lead.longitude, date);
        if (weather.suitable !== false) return { date, weather };
    }
    return null;
}

async function autoAssignProcessedLead(leadId, { excludePilotIds = [], now = new Date(), actorId = null } = {}) {
    let lead = await leadRepository.findById(leadId);
    if (!lead) throw new Error('Lead not found');
    if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reason: `Lead is ${lead.status}, not PROCESSED` };

    const weatherWindow = await selectWeatherDate(lead, now);
    if (!weatherWindow) return moveToManualScheduling(lead, 'No suitable weather day was found in the next five days.', 'WEATHER_RISK', actorId);
    const result = await assignmentOperationRepository.autoAssign({
        leadId,
        scheduledDate: weatherWindow.date,
        weather: weatherWindow.weather,
        excludePilotIds,
        actorId,
    });
    if (result.outcome === 'NO_CAPACITY') {
        return moveToManualScheduling(lead, 'No eligible two-person Pilot/Copilot crew is available; inactive accounts, expired licences, and unavailable shared drone/LMV resources are excluded.', 'NEEDS_MANUAL_SCHEDULING', actorId);
    }
    if (result.outcome !== 'SCHEDULED') return result;
    try {
        await whatsappService.sendMissionScheduled(result.lead, result.assignment.scheduledDate);
    } catch (error) {
        logger.error('assignment.post_commit_delivery_failed', { leadId, assignmentId: result.assignment.id, action: 'MISSION_SCHEDULED', error: error.message });
    }
    logger.info('assignment.auto_assigned', {
        leadId: lead.id,
        assignmentId: result.assignment.id,
        pilotId: result.assignment.pilotId,
        copilotId: result.assignment.copilotId,
        droneId: result.assignment.droneId,
        lmvId: result.assignment.lmvId,
        weatherSuitable: weatherWindow.weather.suitable
    });
    return result;
}

async function reassignUnacceptedAssignment(assignment, now) {
    const released = await assignmentOperationRepository.unassignForReassignment({ assignmentId: assignment.id });
    if (!released) return { outcome: 'SKIPPED', reason: 'Assignment no longer exists' };
    return autoAssignProcessedLead(released.lead.id, { excludePilotIds: [released.assignment.pilotId], now });
}

module.exports = { autoAssignProcessedLead, moveToManualScheduling, reassignUnacceptedAssignment };
