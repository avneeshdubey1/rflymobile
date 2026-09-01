const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { sanitizeAuditReason, sanitizeAuditState } = require('./auditLogRepository');
const { setHistoryActor } = require('./historyActorRepository');
const maintenanceRequestRepository = require('./maintenanceRequestRepository');

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
  pilotAvailabilityState: true,
  archivedAt: true,
  assignedDrone: true,
  assignedDroneId: true,
  assignedLmvId: true,
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
      if (error.code === 'P2034') {
        throw operationError('Scheduling changed concurrently. Refresh the board and retry.', 'SCHEDULING_RETRY_EXHAUSTED');
      }
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

function validateCrewAndAssets({
  lead,
  pilot,
  copilot,
  drone,
  lmv,
  scheduledDate,
  allowAssignedAssets = false,
  requireCopilot = true,
}) {
  if (!pilot || !drone || !lmv || (requireCopilot && !copilot)) {
    throw operationError(requireCopilot
      ? 'A valid primary Pilot, Copilot, drone, and LMV are required'
      : 'A valid primary Pilot, drone, and LMV are required');
  }
  if (copilot && pilot.id === copilot.id) throw operationError('Primary Pilot and Copilot must be different people', 'CONFLICT');
  const crew = [['Primary Pilot', pilot], ...(copilot ? [['Copilot', copilot]] : [])];
  for (const [label, crewMember] of crew) {
    if (crewMember.role !== 'PILOT' || !crewMember.active || crewMember.archivedAt
      || crewMember.pilotAvailabilityState !== 'AVAILABLE' || crewMember.homeCenterId !== lead.matchedCenterId) {
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

function validateServiceWindow(startValue, endValue, { requireFutureStart = false, now = new Date() } = {}) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
    throw operationError('A valid service window with an end after its start is required', 'INVALID_SERVICE_WINDOW');
  }
  if (end.getTime() - start.getTime() > 12 * 60 * 60_000) {
    throw operationError('A service window cannot exceed 12 hours', 'INVALID_SERVICE_WINDOW');
  }
  if (requireFutureStart && start <= now) {
    throw operationError(
      'Choose a future service-window start so the Primary Pilot has time to select a Copilot',
      'COPILOT_SELECTION_WINDOW_CLOSED',
    );
  }
  return { start, end };
}

function storedWindow(assignment) {
  const start = assignment.serviceWindowStart || assignment.scheduledDate;
  const end = assignment.serviceWindowEnd || new Date(start.getTime() + 120 * 60_000);
  return { start, end };
}

function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

async function validateWindowConflicts(transaction, unit, serviceWindowStart, serviceWindowEnd, excludeId = null) {
  const window = validateServiceWindow(serviceWindowStart, serviceWindowEnd);
  const { start: dayStart, end: dayEnd } = dayBounds(window.start);
  const crewIds = [unit.pilotId, unit.copilotId].filter(Boolean);
  const assignments = await transaction.assignment.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      lead: { status: { in: activeLeadStatuses } },
      AND: [{
        OR: [
          { serviceWindowStart: { lt: window.end }, serviceWindowEnd: { gt: window.start } },
          {
            serviceWindowStart: null,
            scheduledDate: {
              gte: new Date(window.start.getTime() - 12 * 60 * 60_000),
              lt: window.end,
            },
          },
        ],
      }],
      OR: [
        { pilotId: { in: crewIds } },
        { copilotId: { in: crewIds } },
        { droneId: unit.droneId },
        { lmvId: unit.lmvId },
      ],
    },
  });
  const conflict = assignments.find((assignment) => {
    const existing = storedWindow(assignment);
    return overlaps(window.start, window.end, existing.start, existing.end);
  });
  if (conflict) {
    const categories = [];
    if ([conflict.pilotId, conflict.copilotId].some((id) => crewIds.includes(id))) categories.push('crew');
    if (conflict.droneId === unit.droneId) categories.push('drone');
    if (conflict.lmvId === unit.lmvId) categories.push('LMV');
    const error = operationError(`The selected ${categories.join(', ')} is unavailable during that service window`, 'CONFLICT');
    error.conflictCategories = categories;
    throw error;
  }
  const sequence = await transaction.assignment.aggregate({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      pilotId: unit.pilotId,
      droneId: unit.droneId,
      lmvId: unit.lmvId,
      serviceWindowStart: { gte: dayStart, lt: dayEnd },
    },
    _max: { dailySequence: true },
  });
  return sequence._max.dailySequence ? sequence._max.dailySequence + 1 : 1;
}

async function startAssignmentNotifications(transaction, assignment, now = new Date(), actorId = null) {
  const configured = (process.env.NOTIFICATION_CASCADE_TIMERS_MS || '').split(',').map(Number).filter(Number.isFinite);
  const timers = configured.length === 4 ? configured : [0, 15 * 60_000, 45 * 60_000, 2 * 60 * 60_000];
  const recipients = [assignment.pilotId, assignment.copilotId].filter(Boolean);
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

async function startPendingCrewNotification(transaction, assignment, actorId = null) {
  await transaction.notification.create({
    data: {
      type: 'PILOT_ASSIGNMENT',
      recipientId: assignment.pilotId,
      leadId: assignment.leadId,
      message: `Assignment ${assignment.id} is reserved. Select an eligible Copilot before the service window starts.`,
    },
  });
  await createRoleNotifications(
    transaction,
    'FLEET_MANAGER',
    'NEEDS_MANUAL_SCHEDULING',
    assignment.leadId,
    `Assignment ${assignment.id} is awaiting Copilot selection by its Primary Pilot.`,
  );
  await audit(transaction, {
    entityType: 'Assignment',
    entityId: assignment.id,
    action: 'COPILOT_SELECTION_PENDING',
    actorId,
    afterState: { crewFormationState: 'PENDING_COPILOT_SELECTION', revision: assignment.revision },
  });
}

async function syncResourceAvailability(transaction, assignment, { droneStatusOverride = null, lmvStatusOverride = null } = {}) {
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
      data: { status: lmvStatusOverride || (otherLmvJob ? 'ASSIGNED' : 'AVAILABLE') },
    });
  }
}

async function manualAssign({ leadId, pilotId, copilotId = null, adminCopilotOverride = false, droneId, lmvId, serviceWindowStart, serviceWindowEnd, scheduledDate, actorId }) {
  return serializable(async (transaction) => {
    const effectiveCopilotId = adminCopilotOverride ? copilotId : null;
    await setHistoryActor(transaction, actorId);
    const resolvedStart = serviceWindowStart || scheduledDate;
    let resolvedEnd = serviceWindowEnd;
    if (!resolvedEnd) {
      const policy = await transaction.autoAssignmentPolicy.findUnique({ where: { singletonKey: 'COMPANY' } });
      resolvedEnd = new Date(new Date(resolvedStart).getTime() + (policy?.defaultJobDurationMinutes || 120) * 60_000);
    }
    const window = validateServiceWindow(resolvedStart, resolvedEnd);
    const { start: dayStart } = dayBounds(window.start);
    await lockKeys(transaction, [`lead:${leadId}`, `schedule:${dayStart.toISOString()}`, pilotId, effectiveCopilotId, droneId, lmvId]);
    let lead = await transaction.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw operationError('A valid lead is required');
    if (!['PROCESSED', 'NEEDS_MANUAL_SCHEDULING'].includes(lead.status)) throw operationError('Only processed or manual-scheduling leads can be assigned', 'CONFLICT');
    lead = await revalidateLead(transaction, lead, actorId);
    validateServiceWindow(window.start, window.end, { requireFutureStart: true });
    const [pilot, copilot, drone, lmv] = await Promise.all([
      transaction.user.findUnique({ where: { id: pilotId } }),
      effectiveCopilotId ? transaction.user.findUnique({ where: { id: effectiveCopilotId } }) : null,
      transaction.drone.findUnique({ where: { id: droneId } }),
      transaction.lMV.findUnique({ where: { id: lmvId } }),
    ]);
    validateCrewAndAssets({
      lead, pilot, copilot, drone, lmv, scheduledDate: window.start, allowAssignedAssets: true, requireCopilot: Boolean(effectiveCopilotId),
    });
    const unit = { pilotId, copilotId: effectiveCopilotId, droneId, lmvId };
    const dailySequence = await validateWindowConflicts(transaction, unit, window.start, window.end);
    const assignment = await transaction.assignment.create({
      data: {
        ...unit,
        leadId,
        scheduledDate: window.start,
        serviceWindowStart: window.start,
        serviceWindowEnd: window.end,
        dailySequence,
        expectedAcreage: lead.acreage,
        autoAssigned: false,
        crewFormationState: effectiveCopilotId ? 'READY' : 'PENDING_COPILOT_SELECTION',
        copilotSelectedAt: effectiveCopilotId ? new Date() : null,
        crewFormationUpdatedAt: new Date(),
      },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: lead.id }, data: { status: 'SCHEDULED' } });
    await Promise.all([
      transaction.drone.update({ where: { id: drone.id }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: lmv.id }, data: { status: 'ASSIGNED' } }),
    ]);
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'MANUAL_ASSIGNMENT_CREATED', actorId, afterState: assignment });
    await audit(transaction, { entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId, beforeState: lead, afterState: scheduledLead });
    if (effectiveCopilotId) {
      await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'COPILOT_ASSIGNED_BY_ADMIN', actorId, afterState: { copilotId: effectiveCopilotId, crewFormationState: 'READY' }, reason: 'ADMIN_MANUAL_SCHEDULING' });
      await startAssignmentNotifications(transaction, assignment, new Date(), actorId);
    } else {
      await startPendingCrewNotification(transaction, assignment, actorId);
    }
    return {
      assignment: await transaction.assignment.findUnique({ where: { id: assignment.id }, include: assignmentInclude }),
      lead: scheduledLead,
    };
  });
}

function decimalAcreage(value) {
  try { return new Prisma.Decimal(value || 0); } catch { return new Prisma.Decimal(0); }
}

function compareStable(left, right) {
  for (let index = 0; index < left.rank.length; index += 1) {
    if (left.rank[index] < right.rank[index]) return -1;
    if (left.rank[index] > right.rank[index]) return 1;
  }
  return left.stableId.localeCompare(right.stableId);
}

function resourceRank(resourceId, horizonAssignments, matches) {
  const assignments = horizonAssignments.filter((assignment) => matches(assignment, resourceId));
  const acreage = assignments.reduce((total, assignment) => total.plus(decimalAcreage(assignment.expectedAcreage)), new Prisma.Decimal(0));
  const last = assignments.reduce((latest, assignment) => Math.max(latest, assignment.serviceWindowStart?.getTime() || assignment.scheduledDate.getTime()), 0);
  return { rank: [assignments.length, Number(acreage.toString()), last || -1], stableId: resourceId };
}

function schedulableUnitKey(assignment) {
  if (!assignment.pilotId || !assignment.droneId || !assignment.lmvId || assignment.legacyCrewIncomplete) return null;
  return [assignment.pilotId, assignment.droneId, assignment.lmvId].join('|');
}

async function autoAssign({
  leadId,
  dayStart,
  dayEnd,
  horizonStart,
  horizonEnd,
  weather,
  excludePilotIds = [],
  actorId = null,
  expectedPolicyRevision,
}) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`lead:${leadId}`, `schedule:${dayStart.toISOString()}`]);
    let lead = await transaction.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw operationError('Lead not found');
    const existingAssignment = await transaction.assignment.findUnique({ where: { leadId }, include: assignmentInclude });
    if (existingAssignment) return { outcome: 'SCHEDULED', assignment: existingAssignment, lead: existingAssignment.lead, idempotent: true };
    if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reasonCode: 'LEAD_NOT_PROCESSED' };
    const policy = await transaction.autoAssignmentPolicy.findUnique({ where: { singletonKey: 'COMPANY' } });
    if (!policy || !policy.enabled || policy.revision !== expectedPolicyRevision) {
      return { outcome: 'POLICY_CHANGED', policyRevision: policy?.revision ?? null };
    }
    lead = await revalidateLead(transaction, lead, null);

    const [pilots, drones, lmvs, horizonAssignments] = await Promise.all([
      transaction.user.findMany({
        where: {
          role: 'PILOT', active: true, archivedAt: null, pilotAvailabilityState: 'AVAILABLE',
          homeCenterId: lead.matchedCenterId, id: { notIn: excludePilotIds },
        },
      }),
      transaction.drone.findMany({
        where: { homeCenterId: lead.matchedCenterId, archivedAt: null, status: { in: ['AVAILABLE', 'ASSIGNED'] }, operationalState: 'IN_SERVICE', availabilityState: { not: 'UNAVAILABLE' } },
      }),
      transaction.lMV.findMany({
        where: { homeCenterId: lead.matchedCenterId, status: { in: ['AVAILABLE', 'ASSIGNED'] }, operationalState: 'IN_SERVICE', availabilityState: { not: 'UNAVAILABLE' } },
      }),
      transaction.assignment.findMany({
        where: { scheduledDate: { gte: horizonStart, lt: horizonEnd }, lead: { status: { in: activeLeadStatuses } } },
      }),
    ]);
    const eligiblePilots = pilots.filter((pilot) => !pilot.pilotLicenseExpiry || pilot.pilotLicenseExpiry > dayStart);
    const eligibleDrones = drones.filter((drone) => !drone.airworthinessExpiry || drone.airworthinessExpiry > dayStart);
    const pilotById = new Map(eligiblePilots.map((pilot) => [pilot.id, pilot]));
    const droneById = new Map(eligibleDrones.map((drone) => [drone.id, drone]));
    const lmvById = new Map(lmvs.map((lmv) => [lmv.id, lmv]));
    if (!eligiblePilots.length) return { outcome: 'NO_CAPACITY', reasonCode: 'NO_ELIGIBLE_PRIMARY_PILOT' };
    if (!eligibleDrones.length) return { outcome: 'NO_CAPACITY', reasonCode: 'NO_ELIGIBLE_DRONE' };
    if (!lmvs.length) return { outcome: 'NO_CAPACITY', reasonCode: 'NO_ELIGIBLE_LMV' };
    const dayAssignments = horizonAssignments.filter((assignment) => assignment.scheduledDate >= dayStart && assignment.scheduledDate < dayEnd);
    const leadAcreage = decimalAcreage(lead.acreageDecimal ?? lead.acreage);
    const durationMs = policy.defaultJobDurationMinutes * 60_000;
    const turnaroundMs = policy.turnaroundMinutes * 60_000;

    let unit = null;
    let serviceWindowStart = null;
    const reusableGroups = new Map();
    for (const assignment of dayAssignments) {
      const key = schedulableUnitKey(assignment);
      if (!key) continue;
      const list = reusableGroups.get(key) || [];
      list.push(assignment);
      reusableGroups.set(key, list);
    }
    const reusable = [];
    for (const [key, assignments] of reusableGroups) {
      const [pilotId, droneId, lmvId] = key.split('|');
      if (!pilotById.has(pilotId) || !droneById.has(droneId) || !lmvById.has(lmvId)) continue;
      if (policy.maxJobsPerUnitPerDay !== null && assignments.length >= policy.maxJobsPerUnitPerDay) continue;
      const acreage = assignments.reduce((total, assignment) => total.plus(decimalAcreage(assignment.expectedAcreage)), new Prisma.Decimal(0));
      if (policy.maxAcreagePerUnitPerDay !== null && acreage.plus(leadAcreage).greaterThan(policy.maxAcreagePerUnitPerDay)) continue;
      const latestEnd = assignments.reduce((latest, assignment) => Math.max(
        latest,
        assignment.serviceWindowEnd?.getTime() || assignment.scheduledDate.getTime() + durationMs,
      ), dayStart.getTime());
      const nextStart = new Date(latestEnd + turnaroundMs);
      if (nextStart.getTime() + durationMs > dayEnd.getTime()) continue;
      const mostRecent = assignments.reduce((latest, assignment) => Math.max(latest, assignment.scheduledDate.getTime()), 0);
      reusable.push({
        unit: { pilotId, copilotId: null, droneId, lmvId },
        start: nextStart,
        rank: [nextStart.getTime(), assignments.length, Number(acreage.toString()), mostRecent],
        stableId: key,
      });
    }
    reusable.sort(compareStable);
    if (reusable.length) {
      unit = reusable[0].unit;
      serviceWindowStart = reusable[0].start;
    }
    if (!unit) {
      if (policy.maxAcreagePerUnitPerDay !== null && leadAcreage.greaterThan(policy.maxAcreagePerUnitPerDay)) {
        return { outcome: 'NO_CAPACITY', reasonCode: 'NO_CAPACITY_IN_HORIZON' };
      }
      const usedPilots = new Set(dayAssignments.flatMap((item) => [item.pilotId, item.copilotId]).filter(Boolean));
      const usedDrones = new Set(dayAssignments.map((item) => item.droneId));
      const usedLmvs = new Set(dayAssignments.map((item) => item.lmvId).filter(Boolean));
      const rank = (items, matcher) => items.map((item) => ({ item, ...resourceRank(item.id, horizonAssignments, matcher) })).sort(compareStable);
      const freePilots = rank(
        eligiblePilots.filter((pilot) => !usedPilots.has(pilot.id)),
        (assignment, id) => assignment.pilotId === id || assignment.copilotId === id,
      );
      const freeDrones = rank(eligibleDrones.filter((item) => !usedDrones.has(item.id)), (assignment, id) => assignment.droneId === id);
      const freeLmvs = rank(lmvs.filter((item) => !usedLmvs.has(item.id)), (assignment, id) => assignment.lmvId === id);
      const selectedPilot = freePilots[0]?.item;
      const drone = selectedPilot?.assignedDroneId
        ? freeDrones.find(({ item }) => item.id === selectedPilot.assignedDroneId)?.item || freeDrones[0]?.item
        : freeDrones[0]?.item;
      const lmv = selectedPilot?.assignedLmvId
        ? freeLmvs.find(({ item }) => item.id === selectedPilot.assignedLmvId)?.item || freeLmvs[0]?.item
        : freeLmvs[0]?.item;
      if (selectedPilot && drone && lmv) {
        unit = { pilotId: selectedPilot.id, copilotId: null, droneId: drone.id, lmvId: lmv.id };
        serviceWindowStart = dayStart;
      }
    }
    if (!unit) return { outcome: 'NO_CAPACITY', reasonCode: 'NO_CAPACITY_IN_HORIZON' };
    const serviceWindowEnd = new Date(serviceWindowStart.getTime() + durationMs);
    if (serviceWindowEnd > dayEnd) return { outcome: 'NO_CAPACITY', reasonCode: 'NO_CAPACITY_IN_HORIZON' };
    await lockKeys(transaction, [unit.pilotId, unit.droneId, unit.lmvId]);
    const [pilot, drone, lmv] = [pilotById.get(unit.pilotId), droneById.get(unit.droneId), lmvById.get(unit.lmvId)];
    validateCrewAndAssets({
      lead, pilot, copilot: null, drone, lmv, scheduledDate: serviceWindowStart, allowAssignedAssets: true, requireCopilot: false,
    });
    const dailySequence = await validateWindowConflicts(transaction, unit, serviceWindowStart, serviceWindowEnd);
    const assignment = await transaction.assignment.create({
      data: {
        ...unit,
        leadId: lead.id,
        scheduledDate: serviceWindowStart,
        serviceWindowStart,
        serviceWindowEnd,
        dailySequence,
        autoAssigned: true,
        expectedAcreage: lead.acreage,
        weatherCheckedAt: new Date(),
        weatherSuitable: weather.suitable,
        weatherNote: weather.note,
        crewFormationState: 'PENDING_COPILOT_SELECTION',
        crewFormationUpdatedAt: new Date(),
      },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: lead.id }, data: { status: 'SCHEDULED' } });
    await Promise.all([
      transaction.drone.update({ where: { id: unit.droneId }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: unit.lmvId }, data: { status: 'ASSIGNED' } }),
    ]);
    await audit(transaction, {
      entityType: 'Assignment', entityId: assignment.id, action: 'AUTO_ASSIGNMENT_SCHEDULED',
      actorId,
      afterState: {
        leadId: lead.id,
        pilotId: unit.pilotId,
        copilotId: null,
        droneId: unit.droneId,
        lmvId: unit.lmvId,
        serviceWindowStart,
        serviceWindowEnd,
        dailySequence,
        policyRevision: policy.revision,
        reasonCode: 'AUTO_ASSIGNMENT_SUCCESS',
      },
      reason: 'AUTO_ASSIGNMENT_SUCCESS',
    });
    await audit(transaction, { entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId, beforeState: { status: lead.status }, afterState: { status: scheduledLead.status } });
    await startPendingCrewNotification(transaction, assignment, actorId);
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

async function moveToManualScheduling({ leadId, reason, reasonCode = 'NO_CAPACITY_IN_HORIZON', notificationType = 'NEEDS_MANUAL_SCHEDULING', actorId = null, policyRevision = null }) {
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
    await audit(transaction, {
      entityType: 'Lead', entityId: lead.id, action: 'NEEDS_MANUAL_SCHEDULING', actorId,
      beforeState: lead,
      afterState: { ...updated, autoAssignment: { reasonCode, policyRevision } },
      reason: reasonCode,
    });
    return { outcome: 'MANUAL_SCHEDULING', lead: updated, reason, reasonCode, policyRevision };
  });
}

async function reschedule({ assignmentId, serviceWindowStart, serviceWindowEnd, pilotId, copilotId, adminCopilotOverride = false, droneId, lmvId, actorId, reason }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const before = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!before) throw operationError('Assignment not found', 'NOT_FOUND');
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(before.lead.status)) throw operationError('Only scheduled or accepted assignments can be rescheduled', 'CONFLICT');
    const previousWindow = storedWindow(before);
    const resolvedEnd = serviceWindowEnd || new Date(
      new Date(serviceWindowStart).getTime() + (previousWindow.end.getTime() - previousWindow.start.getTime()),
    );
    const window = validateServiceWindow(serviceWindowStart, resolvedEnd);
    const { start: dayStart } = dayBounds(window.start);
    await lockKeys(transaction, [`schedule:${dayStart.toISOString()}`]);
    const lead = await revalidateLead(transaction, before.lead, actorId);
    validateServiceWindow(window.start, window.end, { requireFutureStart: true });
    const unit = { pilotId: pilotId || before.pilotId, copilotId: copilotId || before.copilotId, droneId: droneId || before.droneId, lmvId: lmvId || before.lmvId };
    await lockKeys(transaction, [unit.pilotId, unit.copilotId, unit.droneId, unit.lmvId]);
    const [pilot, copilot, drone, lmv] = await Promise.all([
      transaction.user.findUnique({ where: { id: unit.pilotId } }),
      unit.copilotId ? transaction.user.findUnique({ where: { id: unit.copilotId } }) : null,
      transaction.drone.findUnique({ where: { id: unit.droneId } }),
      transaction.lMV.findUnique({ where: { id: unit.lmvId } }),
    ]);
    const copilotWasAssignedByAdmin = adminCopilotOverride && Boolean(copilotId) && before.copilotId !== copilotId;
    validateCrewAndAssets({
      lead,
      pilot,
      copilot,
      drone,
      lmv,
      scheduledDate: window.start,
      allowAssignedAssets: true,
      requireCopilot: before.crewFormationState === 'READY' || copilotWasAssignedByAdmin,
    });
    const { start: previousStart } = dayBounds(before.scheduledDate);
    const nextSequence = await validateWindowConflicts(transaction, unit, window.start, window.end, before.id);
    const sameCrewDay = previousStart.valueOf() === dayStart.valueOf() && sameUnit(before, unit);
    const dailySequence = sameCrewDay ? before.dailySequence : nextSequence;
    const assignment = await transaction.assignment.update({
      where: { id: before.id },
      data: {
        scheduledDate: window.start,
        serviceWindowStart: window.start,
        serviceWindowEnd: window.end,
        pilotId: unit.pilotId,
        copilotId: unit.copilotId,
        droneId: unit.droneId,
        lmvId: unit.lmvId,
        dailySequence,
        acceptedAt: null,
        crewFormationState: copilotWasAssignedByAdmin ? 'READY' : before.crewFormationState,
        copilotSelectedAt: copilotWasAssignedByAdmin ? new Date() : before.copilotSelectedAt,
        crewFormationUpdatedAt: copilotWasAssignedByAdmin ? new Date() : before.crewFormationUpdatedAt,
      },
      include: assignmentInclude,
    });
    const scheduledLead = await transaction.lead.update({ where: { id: before.leadId }, data: { status: 'SCHEDULED' } });
    if ((before.lmvId && before.lmvId !== unit.lmvId) || before.droneId !== unit.droneId) await syncResourceAvailability(transaction, before);
    await Promise.all([
      transaction.drone.update({ where: { id: unit.droneId }, data: { status: 'ASSIGNED' } }),
      transaction.lMV.update({ where: { id: unit.lmvId }, data: { status: 'ASSIGNED' } }),
    ]);
    await transaction.scheduleChangeLog.create({ data: { assignmentId: assignment.id, oldDate: before.scheduledDate, newDate: window.start, changedBy: actorId, reason } });
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'ASSIGNMENT_WINDOW_RESCHEDULED', actorId, beforeState: before, afterState: assignment, reason });
    if (copilotWasAssignedByAdmin) {
      await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'COPILOT_ASSIGNED_BY_ADMIN', actorId, beforeState: { copilotId: before.copilotId, crewFormationState: before.crewFormationState }, afterState: { copilotId: unit.copilotId, crewFormationState: 'READY' }, reason });
    }
    await createRoleNotifications(transaction, 'SALES', 'RESCHEDULE', before.leadId, `Assignment ${assignment.id} was rescheduled to ${window.start.toISOString()}.`);
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

async function transitionMission({ assignmentId, actorId, action, actualAcreage, reason, issueCategory, maintenanceReasonCode, expectedRevision }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const before = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!before) throw operationError('Assignment not found');
    if (![before.pilotId, before.copilotId].includes(actorId)) throw operationError('Only an assigned crew member can change this mission');
    if (typeof expectedRevision !== 'undefined') {
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        throw operationError('A positive assignment revision is required', 'ASSIGNMENT_REVISION_REQUIRED');
      }
      if (before.revision !== expectedRevision) {
        const error = operationError('Assignment changed. Refresh before retrying this action.', 'ASSIGNMENT_REVISION_CONFLICT');
        error.details = { currentRevision: before.revision };
        throw error;
      }
    }
    await lockKeys(transaction, [before.pilotId, before.copilotId, before.droneId, before.lmvId]);
    let assignmentData;
    let leadStatus;
    let auditAction;
    if (action === 'accept') {
      if (before.lead.status !== 'SCHEDULED') throw operationError('Only scheduled missions can be accepted');
      if (before.crewFormationState !== 'READY' || !before.copilotId) {
        throw operationError('Select an eligible Copilot before accepting this mission', 'CREW_FORMATION_INCOMPLETE');
      }
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
      if (before.crewFormationState !== 'READY' || !before.copilotId) {
        throw operationError('Crew formation must be ready before this mission can start', 'CREW_FORMATION_INCOMPLETE');
      }
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
      assignmentData = {
        completedAt: new Date(), actualAcreage: Number(actualAcreage),
        lastKnownLat: null, lastKnownLng: null, lastPingAt: null,
      };
      leadStatus = 'COMPLETED';
      auditAction = 'MISSION_COMPLETED';
    } else if (action === 'decommission') {
      if (!['PILOT_ACCEPTED', 'IN_PROGRESS'].includes(before.lead.status)) throw operationError('Only an accepted or in-progress mission can be decommissioned');
      if (!reason || !String(reason).trim()) throw operationError('A decommission reason is required');
      assignmentData = { decommissionedMidMission: true, decommissionReason: String(reason).trim() };
      Object.assign(assignmentData, { lastKnownLat: null, lastKnownLng: null, lastPingAt: null });
      leadStatus = 'FLAGGED';
      auditAction = 'DRONE_DECOMMISSIONED';
    } else if (action === 'reportIssue') {
      if (!['PILOT_ACCEPTED', 'IN_PROGRESS'].includes(before.lead.status)) {
        throw operationError('Only an accepted or in-progress mission can report an issue');
      }
      const approvedCategories = new Set(['DRONE_MALFUNCTION', 'LMV_MALFUNCTION', 'SAFETY_HAZARD', 'WEATHER_BLOCKER', 'CUSTOMER_BLOCKER', 'OTHER']);
      const normalizedReason = String(reason || '').trim();
      if (!approvedCategories.has(issueCategory)) throw operationError('An approved issue category is required', 'ISSUE_REJECTED');
      if (!normalizedReason || normalizedReason.length > 500) throw operationError('Issue note must contain 1 to 500 characters', 'ISSUE_REJECTED');
      assignmentData = {
        issueCategory,
        issueNote: normalizedReason,
        issueReportedAt: new Date(),
        ...(issueCategory === 'DRONE_MALFUNCTION' ? {
          decommissionedMidMission: true,
          decommissionReason: normalizedReason,
        } : {}),
        lastKnownLat: null,
        lastKnownLng: null,
        lastPingAt: null,
      };
      leadStatus = 'FLAGGED';
      auditAction = 'MISSION_ISSUE_REPORTED';
    } else {
      throw operationError('Unsupported mission transition');
    }
    assignmentData.revision = { increment: 1 };
    const assignment = await transaction.assignment.update({ where: { id: before.id }, data: assignmentData, include: assignmentInclude });
    const lead = await transaction.lead.update({ where: { id: before.leadId }, data: { status: leadStatus } });
    await audit(transaction, { entityType: 'Assignment', entityId: before.id, action: auditAction, actorId, beforeState: before, afterState: assignment, reason });
    await audit(transaction, { entityType: 'Lead', entityId: before.leadId, action: 'STATUS_CHANGE', actorId, beforeState: before.lead, afterState: lead, reason });
    if (action === 'accept' || action === 'decommission') {
      await transaction.notificationEscalation.updateMany({ where: { assignmentId: before.id, closedAt: null }, data: { closedAt: new Date() } });
    }
    if (action === 'complete') await syncResourceAvailability(transaction, before);
    if (action === 'reportIssue') {
      const assetType = issueCategory === 'DRONE_MALFUNCTION'
        ? 'DRONE'
        : issueCategory === 'LMV_MALFUNCTION' ? 'LMV' : null;
      if (assetType) {
        await maintenanceRequestRepository.createFromMission(transaction, {
          assignment: before,
          requestedById: actorId,
          assetType,
          reasonCode: maintenanceReasonCode || 'OTHER',
          reason: String(reason).trim(),
        });
      }
      await syncResourceAvailability(transaction, before, {
        ...(issueCategory === 'DRONE_MALFUNCTION' ? { droneStatusOverride: 'MAINTENANCE' } : {}),
        ...(issueCategory === 'LMV_MALFUNCTION' ? { lmvStatusOverride: 'MAINTENANCE' } : {}),
      });
      await Promise.all([
        createRoleNotifications(transaction, 'ADMIN', assetType ? 'MAINTENANCE_REQUEST' : 'MISSION_FLAGGED', before.leadId, `Assignment ${before.id} reported ${issueCategory}: ${String(reason).trim()}`),
        createRoleNotifications(transaction, 'FLEET_MANAGER', assetType ? 'MAINTENANCE_REQUEST' : 'MISSION_FLAGGED', before.leadId, `Assignment ${before.id} reported ${issueCategory}: ${String(reason).trim()}`),
        ...(assetType ? [createRoleNotifications(transaction, 'FLEET_MANAGER', 'MISSION_FLAGGED', before.leadId, `Assignment ${before.id} was safety-flagged after an asset issue.`)] : []),
      ]);
    }
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
    // A timed-out assignment can already have calendar changes. Preserve the
    // complete assignment (including those changes) in the append-only audit
    // record before releasing its one-to-one Lead slot, then remove the child
    // rows that would otherwise make the reassignment transaction fail.
    await audit(transaction, {
      entityType: 'Assignment',
      entityId: assignment.id,
      action: 'AUTO_ASSIGNMENT_REASSIGNED_AFTER_TIMEOUT',
      beforeState: assignment,
    });
    await transaction.scheduleChangeLog.deleteMany({ where: { assignmentId } });
    await transaction.assignment.delete({ where: { id: assignmentId } });
    const lead = await transaction.lead.update({ where: { id: assignment.leadId }, data: { status: 'PROCESSED' } });
    await syncResourceAvailability(transaction, assignment);
    return { assignment, lead };
  });
}

async function rejectAssignment({ assignmentId, actorId, reason, expectedRevision }) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`]);
    const assignment = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
    if (!assignment) throw operationError('Assignment not found');
    if (assignment.pilotId !== actorId) throw operationError('Only the assigned Primary Pilot can reject this mission');
    if (assignment.lead.status !== 'SCHEDULED' || assignment.startedAt) throw operationError('Only an unstarted scheduled mission can be rejected');
    if (assignment.revision !== expectedRevision) {
      const error = operationError('Assignment changed. Refresh before retrying this action.', 'ASSIGNMENT_REVISION_CONFLICT');
      error.details = { currentRevision: assignment.revision };
      throw error;
    }
    const normalizedReason = String(reason || '').trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 500) throw operationError('Rejection reason must contain 3 to 500 characters', 'REJECTION_REASON_REQUIRED');
    await lockKeys(transaction, [assignment.droneId, assignment.lmvId, `lead:${assignment.leadId}`]);
    await transaction.pilotAssignmentRejection.create({ data: { formerAssignmentId: assignment.id, leadId: assignment.leadId, rejectedByPilotId: actorId, reason: normalizedReason } });
    await transaction.notificationEscalation.deleteMany({ where: { assignmentId } });
    await transaction.notification.updateMany({ where: { leadId: assignment.leadId, readAt: null, type: { in: ['PILOT_ASSIGNMENT', 'PILOT_SMS'] } }, data: { readAt: new Date() } });
    await audit(transaction, { entityType: 'Assignment', entityId: assignment.id, action: 'PILOT_ASSIGNMENT_REJECTED', actorId, beforeState: assignment, reason: normalizedReason });
    await transaction.scheduleChangeLog.deleteMany({ where: { assignmentId } });
    await transaction.assignment.delete({ where: { id: assignment.id } });
    const schedulingNote = `[Scheduling] Primary Pilot rejected assignment: ${normalizedReason}`;
    const lead = await transaction.lead.update({ where: { id: assignment.leadId }, data: { status: 'NEEDS_MANUAL_SCHEDULING', notes: assignment.lead.notes ? `${assignment.lead.notes}\n${schedulingNote}` : schedulingNote } });
    await syncResourceAvailability(transaction, assignment);
    await Promise.all([
      createRoleNotifications(transaction, 'ADMIN', 'NEEDS_MANUAL_SCHEDULING', lead.id, `Pilot rejection requires manual rescheduling for lead ${lead.id}.`),
      createRoleNotifications(transaction, 'FLEET_MANAGER', 'NEEDS_MANUAL_SCHEDULING', lead.id, `Pilot rejection requires manual rescheduling for lead ${lead.id}.`),
    ]);
    await audit(transaction, { entityType: 'Lead', entityId: lead.id, action: 'NEEDS_MANUAL_SCHEDULING', actorId, beforeState: { status: assignment.lead.status }, afterState: { status: lead.status }, reason: 'PILOT_REJECTED_ASSIGNMENT' });
    return { assignmentId, lead };
  });
}

module.exports = {
  autoAssign,
  manualAssign,
  moveToManualScheduling,
  resequence,
  reschedule,
  rejectAssignment,
  transitionMission,
  unassignForReassignment,
};
