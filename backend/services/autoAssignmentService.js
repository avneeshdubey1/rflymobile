const assignmentRepository = require('../src/repositories/assignmentRepository');
const droneRepository = require('../src/repositories/droneRepository');
const leadRepository = require('../src/repositories/leadRepository');
// const lmvRepository = require('../src/repositories/lmvRepository');
const notificationEscalationRepository = require('../src/repositories/notificationEscalationRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const weatherService = require('./weatherService');
const notificationCascadeService = require('./notificationCascadeService');
const whatsappService = require('./whatsappService');
const logger = require('./loggerService');
const { revalidateForScheduling } = require('./leadServiceAreaService');

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function endOfDay(date) {
    const result = startOfDay(date);
    result.setDate(result.getDate() + 1);
    return result;
}

function startOfWeek(date) {
    const result = startOfDay(date);
    result.setDate(result.getDate() - result.getDay());
    return result;
}

function hasExpired(expiry, now) { return expiry && expiry <= now; }

async function moveToManualScheduling(lead, reason, notificationType = 'NEEDS_MANUAL_SCHEDULING') {
    const schedulingNote = `[Scheduling] ${reason}`;
    const updated = await leadRepository.update(lead.id, { status: 'NEEDS_MANUAL_SCHEDULING', notes: lead.notes ? `${lead.notes}\n${schedulingNote}` : schedulingNote });
    await notificationCascadeService.createFleetNotifications(notificationType, lead.id, `Manual scheduling required for lead ${lead.id}: ${reason}`);
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'NEEDS_MANUAL_SCHEDULING', beforeState: lead, afterState: updated, reason });
    logger.warn('assignment.manual_scheduling_required', { leadId: lead.id, notificationType, reason });
    return { outcome: 'MANUAL_SCHEDULING', lead: updated, reason };
}

async function selectWeatherDate(lead, now) {
    for (let offset = 0; offset < 5; offset += 1) {
        const date = startOfDay(now);
        date.setDate(date.getDate() + offset);
        date.setHours(9, 0, 0, 0); // Schedule for 9 AM instead of midnight
        const weather = await weatherService.checkSuitability(lead.latitude, lead.longitude, date);
        if (weather.suitable !== false) return { date, weather };
    }
    return null;
}

async function autoAssignProcessedLead(leadId, { excludePilotIds = [], now = new Date() } = {}) {
    let lead = await leadRepository.findById(leadId);
    if (!lead) throw new Error('Lead not found');
    if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reason: `Lead is ${lead.status}, not PROCESSED` };
    lead = await revalidateForScheduling(lead);

    const weatherWindow = await selectWeatherDate(lead, now);
    if (!weatherWindow) return moveToManualScheduling(lead, 'No suitable weather day was found in the next five days.', 'WEATHER_RISK');

    const pilots = (await userRepository.findAll({ role: 'PILOT', homeCenterId: lead.matchedCenterId }))
        .filter((pilot) => pilot.active && !pilot.archivedAt && !excludePilotIds.includes(pilot.id) && !hasExpired(pilot.pilotLicenseExpiry, now));
    const drones = (await droneRepository.findAll({ status: 'AVAILABLE', homeCenterId: lead.matchedCenterId }))
        .filter((drone) => !hasExpired(drone.airworthinessExpiry, now));
    // const lmvs = await lmvRepository.findEligibleForCenter(lead.matchedCenterId);
    const dayStart = startOfDay(weatherWindow.date);
    const dayEnd = endOfDay(weatherWindow.date);
    const availablePilots = [];
    for (const pilot of pilots) {
        const conflicts = await assignmentRepository.findScheduledForPilotOnDate(pilot.id, dayStart, dayEnd);
        if (conflicts.length === 0) availablePilots.push(pilot);
    }
    // const availableLmvs = [];
    // for (const lmv of lmvs) {
    //   const conflicts = await assignmentRepository.findScheduledForLmvOnDate(lmv.id, dayStart, dayEnd);
    //   if (conflicts.length === 0) availableLmvs.push(lmv);
    // }
    // if (availablePilots.length < 2 || drones.length === 0 || availableLmvs.length === 0) {
    if (availablePilots.length < 2 || drones.length === 0) {
        const reason = availablePilots.length < 2 ?
            'No eligible two-person Pilot/Copilot crew is available; inactive accounts and expired licences are excluded.' :
            drones.length === 0 ?
            'No eligible drone is available; expired airworthiness is excluded.' :
            'No eligible LMV is available at the lead operating centre.';
        return moveToManualScheduling(lead, reason);
    }

    const weekStart = startOfWeek(weatherWindow.date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const scoredPilots = await Promise.all(availablePilots.map(async(pilot) => ({ pilot, workload: await assignmentRepository.countForPilotBetween(pilot.id, weekStart, weekEnd) })));
    console.log("===== AVAILABLE PILOTS =====");

    scoredPilots.forEach(p => {
        console.log({
            name: p.pilot.name,
            assignedDroneId: p.pilot.assignedDroneId,
            active: p.pilot.active,
            licence: p.pilot.pilotLicenseExpiry
        });
    });
    scoredPilots.sort((a, b) => a.workload - b.workload || a.pilot.createdAt - b.pilot.createdAt);
    // const pilot = scoredPilots[0].pilot;
    // const copilot = scoredPilots[1].pilot;
    // const drone = drones[0];

    const pilotResult = scoredPilots.find(p => p.pilot.assignedDroneId);
    const pilot = pilotResult ? pilotResult.pilot : null;

    const copilotResult = scoredPilots.find(
        p => pilot && p.pilot.id !== pilot.id && p.pilot.assignedDroneId
    );
    const copilot = copilotResult ? copilotResult.pilot : null;

    console.log("Pilot:", pilot);
    console.log("Copilot:", copilot);

    if (!pilot || !copilot) {
        return moveToManualScheduling(
            lead,
            "Two pilots with assigned drones are required."
        );
    }

    const pilotDrone = await droneRepository.findById(pilot.assignedDroneId);
    const copilotDrone = await droneRepository.findById(copilot.assignedDroneId);

    console.log("Pilot Drone:", pilotDrone);
    console.log("Copilot Drone:", copilotDrone);
    // if (!pilotDrone || pilotDrone.status !== "AVAILABLE") {
    //     return moveToManualScheduling(
    //         lead,
    //         `Pilot ${pilot.name} has no available assigned drone.`
    //     );
    // }

    if (!pilotDrone) {
        return moveToManualScheduling(
            lead,
            `Pilot ${pilot.name} has no assigned drone.`
        );
    }

    // if (!copilotDrone || copilotDrone.status !== "AVAILABLE") {
    //     return moveToManualScheduling(
    //         lead,
    //         `Copilot ${copilot.name} has no available assigned drone.`
    //     );
    // }

    if (!copilotDrone) {
        return moveToManualScheduling(
            lead,
            `Copilot ${copilot.name} has no assigned drone.`
        );
    }

    // const lmv = availableLmvs[0];
    // const assignment = await assignmentRepository.create({
    //     leadId: lead.id,
    //     pilotId: pilot.id,
    //     copilotId: copilot.id,
    //     droneId: drone.id,
    //     // lmvId: lmv.id,
    //     scheduledDate: weatherWindow.date,
    //     dailySequence: 1,
    //     autoAssigned: true,
    //     expectedAcreage: lead.acreage,
    //     weatherCheckedAt: new Date(),
    //     weatherSuitable: weatherWindow.weather.suitable,
    //     weatherNote: weatherWindow.weather.note,
    // });

    const assignment = await assignmentRepository.create({
        leadId: lead.id,
        pilotId: pilot.id,
        copilotId: copilot.id,
        droneId: pilotDrone.id,
        copilotDroneId: copilotDrone.id,
        scheduledDate: weatherWindow.date,
        dailySequence: 1,
        autoAssigned: true,
        expectedAcreage: lead.acreage,
        weatherCheckedAt: new Date(),
        weatherSuitable: weatherWindow.weather.suitable,
        weatherNote: weatherWindow.weather.note,
    });
    const scheduledLead = await leadRepository.update(lead.id, { status: 'SCHEDULED' });
    // await droneRepository.update(drone.id, { status: 'ASSIGNED' });
    // await droneRepository.update(copilotDrone.id, {
    //     status: 'ASSIGNED'
    // });
    // await droneRepository.update(pilotDrone.id, {
    //     status: "ASSIGNED"
    // });

    // await droneRepository.update(copilotDrone.id, {
    //     status: "ASSIGNED"
    // });

    await droneRepository.update(pilotDrone.id, {
        status: "IN_MISSION"
    });

    await droneRepository.update(copilotDrone.id, {
        status: "IN_MISSION"
    });

    // await lmvRepository.update(lmv.id, { status: 'ASSIGNED' });
    await auditLogRepository.create({
        entityType: 'Lead',
        entityId: lead.id,
        action: 'AUTO_ASSIGNED',
        beforeState: { status: lead.status },
        afterState: { status: scheduledLead.status },
        // reason: `Two-person crew, drone, and LMV assigned for ${weatherWindow.date.toISOString()}`
        reason: `Two-person crew and drone assigned for ${weatherWindow.date.toISOString()}`
    });
    await whatsappService.sendMissionScheduled(scheduledLead, assignment.scheduledDate);
    if (weatherWindow.weather.suitable === null) await notificationCascadeService.createFleetNotifications('WEATHER_RISK', lead.id, `Weather data was unavailable for automatically scheduled lead ${lead.id}; manual review is required.`);
    await notificationCascadeService.start(assignment);
    logger.info('assignment.auto_assigned', {
        leadId: lead.id,
        assignmentId: assignment.id,
        pilotId: pilot.id,
        copilotId: copilot.id,
        droneId: pilotDrone.id,
        copilotDroneId: copilotDrone.id,
        // droneId: drone.id,
        //  lmvId: lmv.id,
        weatherSuitable: weatherWindow.weather.suitable
    });
    return { outcome: 'SCHEDULED', lead: scheduledLead, assignment };
}

async function reassignUnacceptedAssignment(assignment, now) {
    await notificationEscalationRepository.deleteByAssignmentId(assignment.id);
    await droneRepository.update(assignment.droneId, { status: 'AVAILABLE' });
    if (assignment.lmvId) await lmvRepository.update(assignment.lmvId, { status: 'AVAILABLE' });
    await assignmentRepository.delete(assignment.id);
    const lead = await leadRepository.update(assignment.leadId, { status: 'PROCESSED' });
    await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'AUTO_REASSIGNMENT_STARTED', beforeState: assignment });
    return autoAssignProcessedLead(lead.id, { excludePilotIds: [assignment.pilotId], now });
}

module.exports = { autoAssignProcessedLead, moveToManualScheduling, reassignUnacceptedAssignment };