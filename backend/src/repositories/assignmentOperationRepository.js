const prisma = require('../lib/prisma');
const { sanitizeAuditReason, sanitizeAuditState } = require('./auditLogRepository');
const { setHistoryActor } = require('./historyActorRepository');

const activeLeadStatuses = ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'];
const pilotSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  preferredLanguage: true,
  homeCenterId: true,
  pilotLicenseExpiry: true,
  active: true,
  archivedAt: true,
  assignedDrone: true,
  createdAt: true,
};
const assignmentInclude = {
  lead: true,
  pilot: { select: pilotSelect },
  copilot: { select: pilotSelect },
  drone: true,
  copilotDrone: true,
  lmv: true,
  rescheduleHistory: true,
};

function dayBounds(date) {
  const start = new Date(date);
  // Prisma stores these values as UTC timestamps and the database uniqueness
  // index groups them by the stored calendar date. Use UTC boundaries here so
  // application conflict checks and the database index cannot disagree near
  // midnight when the host has a non-UTC timezone.
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function operationError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

async function serializable(execute, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(execute, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' && attempt < attempts - 1) continue;
      throw error;
    }
  }
  throw operationError('The operation could not be serialized');
}

async function lockKeys(transaction, keys) {
  const unique = [...new Set(keys.filter(Boolean).map(String))].sort();
  for (const key of unique) {
    // PostgreSQL's advisory-lock function returns void. Cast it so Prisma can
    // deserialize the otherwise unsupported result type while retaining the
    // transaction-scoped lock semantics.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
  }
}

async function audit(transaction, data) {
  return transaction.auditLog.create({
    data: {
      ...data,
      beforeState: sanitizeAuditState(data.beforeState),
      afterState: sanitizeAuditState(data.afterState),
      reason: sanitizeAuditReason(data.reason),
    },
  });
}

function haversineDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * (Math.PI / 180);
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function revalidateLead(transaction, lead, actorId) {
  if (!Number.isFinite(lead.latitude) || !Number.isFinite(lead.longitude)) {
    throw operationError('The request requires service-area revalidation before scheduling', 'SERVICE_AREA_REVALIDATION_REQUIRED');
  }
  const centers = await transaction.operatingCenter.findMany({ where: { active: true } });
  const matched = centers
    .map((center) => ({ center, distanceKm: haversineDistanceKm(lead.latitude, lead.longitude, center.latitude, center.longitude) }))
    .filter(({ center, distanceKm }) => distanceKm <= center.radiusKm)
    .sort((left, right) => {
      // Preserve the already validated center when overlapping service areas
      // are equally near. This avoids silently moving an existing lead to a
      // different crew pool merely because UUID ordering changed.
      if (Math.abs(left.distanceKm - right.distanceKm) <= 0.000001) {
        if (left.center.id === lead.matchedCenterId) return -1;
        if (right.center.id === lead.matchedCenterId) return 1;
      }
      return left.distanceKm - right.distanceKm || left.center.id.localeCompare(right.center.id);
    })[0];
  if (!matched) throw operationError('The active service area no longer covers this request', 'SERVICE_AREA_REVALIDATION_FAILED');

  const distanceChanged = !Number.isFinite(lead.distanceFromCenterKm)
    || Math.abs(lead.distanceFromCenterKm - matched.distanceKm) > 0.000001;
  if (lead.matchedCenterId === matched.center.id && !distanceChanged) return lead;
  const updated = await transaction.lead.update({
    where: { id: lead.id },
    data: { matchedCenterId: matched.center.id, distanceFromCenterKm: matched.distanceKm },
  });
  await audit(transaction, {
    entityType: 'Lead',
    entityId: lead.id,
    action: 'SERVICE_AREA_REVALIDATED',
    actorId,
    beforeState: { matchedCenterId: lead.matchedCenterId },
    afterState: { matchedCenterId: updated.matchedCenterId },
  });
  return updated;
}

function validateCrewAndAssets({ lead, pilot, copilot, drone, lmv, scheduledDate, allowAssignedAssets = false }) {
  if (!pilot || !copilot || !drone || !lmv) throw operationError('A valid primary Pilot, Copilot, drone, and LMV are required');
  if (pilot.id === copilot.id) throw operationError('Primary Pilot and Copilot must be different people', 'CONFLICT');
  for (const [label, crewMember] of [['Primary Pilot', pilot], ['Copilot', copilot]]) {
    if (crewMember.role !== 'PILOT' || !crewMember.active || crewMember.archivedAt || crewMember.homeCenterId !== lead.matchedCenterId) {
      throw operationError(`${label} must be active and belong to the lead operating centre`, 'CONFLICT');
    }
    if (crewMember.pilotLicenseExpiry && crewMember.pilotLicenseExpiry <= scheduledDate) {
      throw operationError(`${label} licence is expired for the scheduled date`, 'CONFLICT');
    }
  }
  const allowedStatuses = allowAssignedAssets ? ['AVAILABLE', 'ASSIGNED'] : ['AVAILABLE'];
  if (drone.archivedAt || drone.homeCenterId !== lead.matchedCenterId
    || !allowedStatuses.includes(drone.status)
    || drone.operationalState !== 'IN_SERVICE'
    || drone.availabilityState === 'UNAVAILABLE'
    || (drone.airworthinessExpiry && drone.airworthinessExpiry <= scheduledDate)) {
    throw operationError('Drone must be operational and schedulable at the lead operating centre', 'CONFLICT');
  }
  if (lmv.homeCenterId !== lead.matchedCenterId
    || !allowedStatuses.includes(lmv.status)
    || lmv.operationalState !== 'IN_SERVICE'
    || lmv.availabilityState === 'UNAVAILABLE') {
    throw operationError('LMV must be operational and schedulable at the lead operating centre', 'CONFLICT');
  }
}

function sameUnit(assignment, unit) {
  return assignment.pilotId === unit.pilotId
    && assignment.copilotId === unit.copilotId
    && assignment.droneId === unit.droneId
    && assignment.lmvId === unit.lmvId;
}

async function validateDayConflicts(transaction, unit, scheduledDate, excludeId = null) {
  const { start, end } = dayBounds(scheduledDate);
  const assignments = await transaction.assignment.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      scheduledDate: { gte: start, lt: end },
      lead: { status: { in: activeLeadStatuses } },
      OR: [
        { pilotId: { in: [unit.pilotId, unit.copilotId] } },
        { copilotId: { in: [unit.pilotId, unit.copilotId] } },
        { droneId: unit.droneId },
        { lmvId: unit.lmvId },
      ],
    },
  });
  if (assignments.some((assignment) => !sameUnit(assignment, unit))) {
    throw operationError('A crew member, drone, or LMV is already scheduled with another operational unit that day', 'CONFLICT');
  }
  const sequence = await transaction.assignment.aggregate({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      pilotId: unit.pilotId,
      copilotId: unit.copilotId,
      droneId: unit.droneId,
      lmvId: unit.lmvId,
      scheduledDate: { gte: start, lt: end },
    },
    _max: { dailySequence: true },
  });
  return sequence._max.dailySequence ? sequence._max.dailySequence + 1 : 1;
}

async function startAssignmentNotifications(transaction, assignment, now = new Date(), actorId = null) {
  const configured = (process.env.NOTIFICATION_CASCADE_TIMERS_MS || '').split(',').map(Number).filter(Number.isFinite);
  const timers = configured.length === 4 ? configured : [0, 15 * 60_000, 45 * 60_000, 2 * 60 * 60_000];
  const recipients = [assignment.pilotId, assignment.copilotId];
  await transaction.notification.createMany({
    data: recipients.map((recipientId) => ({
      type: 'PILOT_ASSIGNMENT',
      recipientId,
      leadId: assignment.leadId,
      message: `New crew assignment ${assignment.id}, job ${assignment.dailySequence}, scheduled for ${assignment.scheduledDate.toISOString()}.`,
    })),
  });
  const escalation = await transaction.notificationEscalation.upsert({
    where: { assignmentId: assignment.id },
    create: { assignmentId: assignment.id, stage: 'PUSH_SENT', nextActionAt: new Date(now.getTime() + timers[1]) },
    update: { stage: 'PUSH_SENT', nextActionAt: new Date(now.getTime() + timers[1]), reassignCount: 0, closedAt: null },
  });
  await audit(transaction, {
    entityType: 'Assignment',
    entityId: assignment.id,
    action: 'PILOT_PUSH_SENT',
    actorId,
    afterState: { escalationId: escalation.id },
  });
}

async function createRoleNotifications(transaction, role, type, leadId, message) {
  const recipients = await transaction.user.findMany({
    where: { role, active: true, archivedAt: null },
    select: { id: true },
  });
  if (recipients.length) {
    await transaction.notification.createMany({ data: recipients.map(({ id }) => ({ type, recipientId: id, leadId, message })) });
  }
}

async function syncResourceAvailability(transaction, assignment, { droneStatusOverride = null } = {}) {
  const [otherDroneJob, otherLmvJob] = await Promise.all([
    transaction.assignment.findFirst({
      where: { id: { not: assignment.id }, droneId: assignment.droneId, lead: { status: { in: activeLeadStatuses } } },
      select: { id: true },
    }),
    assignment.lmvId ? transaction.assignment.findFirst({
      where: { id: { not: assignment.id }, lmvId: assignment.lmvId, lead: { status: { in: activeLeadStatuses } } },
      select: { id: true },
    }) : null,
  ]);
  await transaction.drone.update({
    where: { id: assignment.droneId },
    data: { status: droneStatusOverride || (otherDroneJob ? 'ASSIGNED' : 'AVAILABLE') },
  });
  if (assignment.lmvId) {
    await transaction.lMV.update({
      where: { id: assignment.lmvId },
      data: { status: otherLmvJob ? 'ASSIGNED' : 'AVAILABLE' },
    });
  }
}

async function manualAssign({ leadId, pilotId, copilotId, droneId, lmvId, scheduledDate, actorId }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    const { start } = dayBounds(scheduledDate);
    await lockKeys(transaction, [`lead:${leadId}`, `schedule:${start.toISOString()}`, pilotId, copilotId, droneId, lmvId]);
    let lead = await transaction.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw operationError('A valid lead is required');
    if (!['PROCESSED', 'NEEDS_MANUAL_SCHEDULING'].includes(lead.status)) throw operationError('Only processed or manual-scheduling leads can be assigned', 'CONFLICT');
    lead = await revalidateLead(transaction, lead, actorId);
    const [pilot, copilot, drone, lmv] = await Promise.all([
      transaction.user.findUnique({ where: { id: pilotId } }),
      transaction.user.findUnique({ where: { id: copilotId } }),
      transaction.drone.findUnique({ where: { id: droneId } }),
      transaction.lMV.findUnique({ where: { id: lmvId } }),
    ]);
    validateCrewAndAssets({ lead, pilot, copilot, drone, lmv, scheduledDate, allowAssignedAssets: true });
    const unit = { pilotId, copilotId, droneId, lmvId };
    const dailySequence = await validateDayConflicts(transaction, unit, scheduledDate);
    const assignment = await transaction.assignment.create({
      data: { ...unit, leadId, scheduledDate, dailySequence, expectedAcreage: lead.acreage, autoAssigned: false },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: lead.id }, data: { status: 'SCHEDULED' } });
    await Promise.all([
      transaction.drone.update({ where: { id: drone.id }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: lmv.id }, data: { status: 'ASSIGNED' } }),
    ]);
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'MANUAL_ASSIGNMENT_CREATED', actorId, afterState: assignment });
    await audit(transaction, { entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId, beforeState: lead, afterState: scheduledLead });
    await startAssignmentNotifications(transaction, assignment, new Date(), actorId);
    return {
      assignment: await transaction.assignment.findUnique({ where: { id: assignment.id }, include: assignmentInclude }),
      lead: scheduledLead,
    };
  });
}

async function autoAssign({ leadId, scheduledDate, weather, excludePilotIds = [], actorId = null }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    const { start, end } = dayBounds(scheduledDate);
    await lockKeys(transaction, [`lead:${leadId}`, `schedule:${start.toISOString()}`]);
    let lead = await transaction.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw operationError('Lead not found');
    if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reason: `Lead is ${lead.status}, not PROCESSED` };
    lead = await revalidateLead(transaction, lead, null);

    const [pilots, drones, lmvs, dayAssignments] = await Promise.all([
      transaction.user.findMany({
        where: { role: 'PILOT', active: true, archivedAt: null, homeCenterId: lead.matchedCenterId, id: { notIn: excludePilotIds } },
        orderBy: { createdAt: 'asc' },
      }),
      transaction.drone.findMany({
        where: { homeCenterId: lead.matchedCenterId, archivedAt: null, status: { in: ['AVAILABLE', 'ASSIGNED'] }, operationalState: 'IN_SERVICE', availabilityState: { not: 'UNAVAILABLE' } },
        orderBy: { createdAt: 'asc' },
      }),
      transaction.lMV.findMany({
        where: { homeCenterId: lead.matchedCenterId, status: { in: ['AVAILABLE', 'ASSIGNED'] }, operationalState: 'IN_SERVICE', availabilityState: { not: 'UNAVAILABLE' } },
        orderBy: { createdAt: 'asc' },
      }),
      transaction.assignment.findMany({
        where: { scheduledDate: { gte: start, lt: end }, lead: { status: { in: activeLeadStatuses } } },
        orderBy: [{ dailySequence: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const eligiblePilots = pilots.filter((pilot) => !pilot.pilotLicenseExpiry || pilot.pilotLicenseExpiry > scheduledDate);
    const eligibleDrones = drones.filter((drone) => !drone.airworthinessExpiry || drone.airworthinessExpiry > scheduledDate);
    const pilotById = new Map(eligiblePilots.map((pilot) => [pilot.id, pilot]));
    const droneById = new Map(eligibleDrones.map((drone) => [drone.id, drone]));
    const lmvById = new Map(lmvs.map((lmv) => [lmv.id, lmv]));

    let unit = null;
    for (const existing of dayAssignments) {
      if (existing.copilotId && pilotById.has(existing.pilotId) && pilotById.has(existing.copilotId)
        && droneById.has(existing.droneId) && existing.lmvId && lmvById.has(existing.lmvId)) {
        unit = { pilotId: existing.pilotId, copilotId: existing.copilotId, droneId: existing.droneId, lmvId: existing.lmvId };
        break;
      }
    }
    if (!unit) {
      const usedPilots = new Set(dayAssignments.flatMap((item) => [item.pilotId, item.copilotId]).filter(Boolean));
      const usedDrones = new Set(dayAssignments.map((item) => item.droneId));
      const usedLmvs = new Set(dayAssignments.map((item) => item.lmvId).filter(Boolean));
      const freePilots = eligiblePilots.filter((pilot) => !usedPilots.has(pilot.id));
      const drone = eligibleDrones.find((item) => item.status === 'AVAILABLE' && !usedDrones.has(item.id));
      const lmv = lmvs.find((item) => item.status === 'AVAILABLE' && !usedLmvs.has(item.id));
      if (freePilots.length >= 2 && drone && lmv) {
        unit = { pilotId: freePilots[0].id, copilotId: freePilots[1].id, droneId: drone.id, lmvId: lmv.id };
      }
    }
    if (!unit) return { outcome: 'NO_CAPACITY' };
    const [pilot, copilot, drone, lmv] = [pilotById.get(unit.pilotId), pilotById.get(unit.copilotId), droneById.get(unit.droneId), lmvById.get(unit.lmvId)];
    validateCrewAndAssets({ lead, pilot, copilot, drone, lmv, scheduledDate, allowAssignedAssets: true });
    const dailySequence = await validateDayConflicts(transaction, unit, scheduledDate);
    const assignment = await transaction.assignment.create({
      data: {
        ...unit,
        leadId: lead.id,
        scheduledDate,
        dailySequence,
        autoAssigned: true,
        expectedAcreage: lead.acreage,
        weatherCheckedAt: new Date(),
        weatherSuitable: weather.suitable,
        weatherNote: weather.note,
      },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: lead.id }, data: { status: 'SCHEDULED' } });
    await Promise.all([
      transaction.drone.update({ where: { id: unit.droneId }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: unit.lmvId }, data: { status: 'ASSIGNED' } }),
    ]);
    await audit(transaction, {
      entityType: 'Lead', entityId: lead.id, action: 'AUTO_ASSIGNED', beforeState: { status: lead.status }, afterState: { status: scheduledLead.status },
      actorId,
      reason: `Two-person crew, drone, and LMV assigned for ${scheduledDate.toISOString()}`,
    });
    await startAssignmentNotifications(transaction, assignment, new Date(), actorId);
    if (weather.suitable === null) {
      await createRoleNotifications(transaction, 'FLEET_MANAGER', 'WEATHER_RISK', lead.id, `Weather data was unavailable for automatically scheduled lead ${lead.id}; manual review is required.`);
    }
    return {
      outcome: 'SCHEDULED',
      lead: scheduledLead,
      assignment: await transaction.assignment.findUnique({ where: { id: assignment.id }, include: assignmentInclude }),
    };
  });
}

async function moveToManualScheduling({ leadId, reason, notificationType = 'NEEDS_MANUAL_SCHEDULING', actorId = null }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`lead:${leadId}`]);
    const lead = await transaction.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw operationError('Lead not found');
    if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', lead, reason: `Lead is ${lead.status}, not PROCESSED` };
    const schedulingNote = `[Scheduling] ${reason}`;
    const updated = await transaction.lead.update({
      where: { id: lead.id },
      data: { status: 'NEEDS_MANUAL_SCHEDULING', notes: lead.notes ? `${lead.notes}\n${schedulingNote}` : schedulingNote },
    });
    await createRoleNotifications(transaction, 'FLEET_MANAGER', notificationType, lead.id, `Manual scheduling required for lead ${lead.id}: ${reason}`);
    await audit(transaction, { entityType: 'Lead', entityId: lead.id, action: 'NEEDS_MANUAL_SCHEDULING', actorId, beforeState: lead, afterState: updated, reason });
    return { outcome: 'MANUAL_SCHEDULING', lead: updated, reason };
  });
}

async function reschedule({ assignmentId, scheduledDate, pilotId, copilotId, lmvId, actorId, reason }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    const { start } = dayBounds(scheduledDate);
    await lockKeys(transaction, [`assignment:${assignmentId}`, `schedule:${start.toISOString()}`]);
    const before = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!before) throw operationError('Assignment not found', 'NOT_FOUND');
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(before.lead.status)) throw operationError('Only scheduled or accepted assignments can be rescheduled', 'CONFLICT');
    const lead = await revalidateLead(transaction, before.lead, actorId);
    const unit = { pilotId: pilotId || before.pilotId, copilotId: copilotId || before.copilotId, droneId: before.droneId, lmvId: lmvId || before.lmvId };
    await lockKeys(transaction, [unit.pilotId, unit.copilotId, unit.droneId, unit.lmvId]);
    const [pilot, copilot, drone, lmv] = await Promise.all([
      transaction.user.findUnique({ where: { id: unit.pilotId } }),
      transaction.user.findUnique({ where: { id: unit.copilotId } }),
      transaction.drone.findUnique({ where: { id: unit.droneId } }),
      transaction.lMV.findUnique({ where: { id: unit.lmvId } }),
    ]);
    validateCrewAndAssets({ lead, pilot, copilot, drone, lmv, scheduledDate, allowAssignedAssets: true });
    const { start: previousStart } = dayBounds(before.scheduledDate);
    const sameCrewDay = previousStart.valueOf() === start.valueOf() && sameUnit(before, unit);
    const dailySequence = sameCrewDay ? before.dailySequence : await validateDayConflicts(transaction, unit, scheduledDate, before.id);
    const assignment = await transaction.assignment.update({
      where: { id: before.id },
      data: { scheduledDate, pilotId: unit.pilotId, copilotId: unit.copilotId, lmvId: unit.lmvId, dailySequence, acceptedAt: null },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: before.leadId }, data: { status: 'SCHEDULED' } });
    if (before.lmvId && before.lmvId !== unit.lmvId) await syncResourceAvailability(transaction, before);
    await Promise.all([
      transaction.drone.update({ where: { id: unit.droneId }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: unit.lmvId }, data: { status: 'ASSIGNED' } }),
    ]);
    await transaction.scheduleChangeLog.create({ data: { assignmentId: assignment.id, oldDate: before.scheduledDate, newDate: scheduledDate, changedBy: actorId, reason } });
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'RESCHEDULE', actorId, beforeState: before, afterState: assignment, reason });
    await createRoleNotifications(transaction, 'SALES', 'RESCHEDULE', before.leadId, `Assignment for ${before.lead.farmerName} was rescheduled from ${before.scheduledDate.toISOString()} to ${scheduledDate.toISOString()}.`);
    for (const previousPilotId of [before.pilotId, before.copilotId]) {
      if (previousPilotId && ![unit.pilotId, unit.copilotId].includes(previousPilotId)) {
        await transaction.notification.updateMany({
          where: { recipientId: previousPilotId, leadId: before.leadId, readAt: null, type: { in: ['PILOT_ASSIGNMENT', 'PILOT_SMS'] } },
          data: { readAt: new Date() },
        });
      }
    }
    await startAssignmentNotifications(transaction, assignment, new Date(), actorId);
    return {
      assignment: await transaction.assignment.findUnique({ where: { id: assignment.id }, include: assignmentInclude }),
      lead: scheduledLead,
      before,
    };
  });
}

async function resequence({ assignmentId, dailySequence, actorId }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const before = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!before) throw operationError('Assignment not found', 'NOT_FOUND');
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(before.lead.status)) throw operationError('Only queued missions can be reordered');
    const { start, end } = dayBounds(before.scheduledDate);
    await lockKeys(transaction, [`schedule:${start.toISOString()}`]);
    const jobs = await transaction.assignment.findMany({
      where: { pilotId: before.pilotId, copilotId: before.copilotId, droneId: before.droneId, lmvId: before.lmvId, scheduledDate: { gte: start, lt: end } },
      orderBy: [{ dailySequence: 'asc' }, { createdAt: 'asc' }],
    });
    const reordered = jobs.filter((item) => item.id !== assignmentId);
    reordered.splice(Math.max(0, Math.min(dailySequence - 1, reordered.length)), 0, before);
    await transaction.assignment.updateMany({ where: { id: { in: reordered.map(({ id }) => id) } }, data: { dailySequence: { increment: 1000000 } } });
    for (let index = 0; index < reordered.length; index += 1) {
      await transaction.assignment.update({ where: { id: reordered[index].id }, data: { dailySequence: index + 1 } });
    }
    const assignment = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    await audit(transaction, {
      entityType: 'Assignment', entityId: assignmentId, action: 'DAILY_SEQUENCE_CHANGED', actorId,
      beforeState: { dailySequence: before.dailySequence }, afterState: { dailySequence: assignment.dailySequence },
    });
    return assignment;
  });
}

async function transitionMission({ assignmentId, actorId, action, actualAcreage, reason }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const before = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!before) throw operationError('Assignment not found');
    if (![before.pilotId, before.copilotId].includes(actorId)) throw operationError('Only an assigned crew member can change this mission');
    await lockKeys(transaction, [before.pilotId, before.copilotId, before.droneId, before.lmvId]);
    let assignmentData;
    let leadStatus;
    let auditAction;
    if (action === 'accept') {
      if (before.lead.status !== 'SCHEDULED') throw operationError('Only scheduled missions can be accepted');
      validateCrewAndAssets({
        lead: before.lead,
        pilot: before.pilot,
        copilot: before.copilot,
        drone: before.drone,
        lmv: before.lmv,
        scheduledDate: before.scheduledDate,
        allowAssignedAssets: true,
      });
      assignmentData = { acceptedAt: new Date() };
      leadStatus = 'PILOT_ACCEPTED';
      auditAction = 'PILOT_ACCEPTED';
    } else if (action === 'start') {
      if (before.lead.status !== 'PILOT_ACCEPTED') throw operationError('A mission must be accepted before it can start');
      validateCrewAndAssets({ lead: before.lead, pilot: before.pilot, copilot: before.copilot, drone: before.drone, lmv: before.lmv, scheduledDate: new Date(), allowAssignedAssets: true });
      const conflicts = await transaction.assignment.findFirst({
        where: {
          id: { not: before.id }, lead: { status: 'IN_PROGRESS' },
          OR: [{ pilotId: { in: [before.pilotId, before.copilotId] } }, { copilotId: { in: [before.pilotId, before.copilotId] } }, { droneId: before.droneId }, { lmvId: before.lmvId }],
        },
        select: { id: true },
      });
      if (conflicts) throw operationError('Another job using this crew, drone, or LMV is already in progress');
      const { start, end } = dayBounds(before.scheduledDate);
      const earlier = await transaction.assignment.findFirst({
        where: {
          id: { not: before.id }, pilotId: before.pilotId, copilotId: before.copilotId, droneId: before.droneId, lmvId: before.lmvId,
          scheduledDate: { gte: start, lt: end }, dailySequence: { lt: before.dailySequence }, lead: { status: { in: activeLeadStatuses } },
        },
        orderBy: { dailySequence: 'asc' }, select: { dailySequence: true },
      });
      if (earlier) throw operationError(`Complete job ${earlier.dailySequence} before starting this job`);
      assignmentData = { startedAt: new Date() };
      leadStatus = 'IN_PROGRESS';
      auditAction = 'MISSION_STARTED';
    } else if (action === 'complete') {
      if (before.lead.status !== 'IN_PROGRESS') throw operationError('Only an in-progress mission can be completed');
      if (!Number.isFinite(Number(actualAcreage)) || Number(actualAcreage) <= 0) throw operationError('A positive actual acreage is required');
      assignmentData = { completedAt: new Date(), actualAcreage: Number(actualAcreage) };
      leadStatus = 'COMPLETED';
      auditAction = 'MISSION_COMPLETED';
    } else if (action === 'decommission') {
      if (!['PILOT_ACCEPTED', 'IN_PROGRESS'].includes(before.lead.status)) throw operationError('Only an accepted or in-progress mission can be decommissioned');
      if (!reason || !String(reason).trim()) throw operationError('A decommission reason is required');
      assignmentData = { decommissionedMidMission: true, decommissionReason: String(reason).trim() };
      leadStatus = 'FLAGGED';
      auditAction = 'DRONE_DECOMMISSIONED';
    } else {
      throw operationError('Unsupported mission transition');
    }
    const assignment = await transaction.assignment.update({ where: { id: before.id }, data: assignmentData, include: assignmentInclude });
    const lead = await transaction.lead.update({ where: { id: before.leadId }, data: { status: leadStatus } });
    await audit(transaction, { entityType: 'Assignment', entityId: before.id, action: auditAction, actorId, beforeState: before, afterState: assignment, reason });
    await audit(transaction, { entityType: 'Lead', entityId: before.leadId, action: 'STATUS_CHANGE', actorId, beforeState: before.lead, afterState: lead, reason });
    if (action === 'accept' || action === 'decommission') {
      await transaction.notificationEscalation.updateMany({ where: { assignmentId: before.id, closedAt: null }, data: { closedAt: new Date() } });
    }
    if (action === 'complete') await syncResourceAvailability(transaction, before);
    if (action === 'decommission') {
      await syncResourceAvailability(transaction, before, { droneStatusOverride: 'MAINTENANCE' });
      await createRoleNotifications(transaction, 'FLEET_MANAGER', 'DRONE_DECOMMISSIONED', before.leadId, `Drone ${before.droneId} was decommissioned during assignment ${before.id}: ${String(reason).trim()}`);
    }
    return {
      assignment: await transaction.assignment.findUnique({ where: { id: assignment.id }, include: assignmentInclude }),
      lead,
    };
  });
}

async function unassignForReassignment({ assignmentId, actorId = null }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const assignment = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!assignment) return null;
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(assignment.lead.status)) throw operationError('Only an unstarted mission can be reassigned');
    await lockKeys(transaction, [assignment.droneId, assignment.lmvId, `lead:${assignment.leadId}`]);
    await transaction.notificationEscalation.deleteMany({ where: { assignmentId } });
    await transaction.notification.updateMany({
      where: { leadId: assignment.leadId, readAt: null, type: { in: ['PILOT_ASSIGNMENT', 'PILOT_SMS'] } },
      data: { readAt: new Date() },
    });
    await transaction.assignment.delete({ where: { id: assignmentId } });
    const lead = await transaction.lead.update({ where: { id: assignment.leadId }, data: { status: 'PROCESSED' } });
    await syncResourceAvailability(transaction, assignment);
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'AUTO_REASSIGNMENT_STARTED', beforeState: assignment });
    return { assignment, lead };
  });
}

module.exports = {
  autoAssign,
  manualAssign,
  moveToManualScheduling,
  resequence,
  reschedule,
  transitionMission,
  unassignForReassignment,
};
