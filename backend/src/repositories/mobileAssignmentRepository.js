const prisma = require('../lib/prisma');

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'FLAGGED'];
const MAX_LIST_ITEMS = 100;
const MAX_RANGE_DAYS = 31;
const TERMINAL_RETENTION_DAYS = 30;
const FUTURE_HORIZON_DAYS = 90;

const assignmentSelect = {
  id: true,
  leadId: true,
  pilotId: true,
  copilotId: true,
  crewFormationState: true,
  revision: true,
  dailySequence: true,
  scheduledDate: true,
  serviceWindowStart: true,
  serviceWindowEnd: true,
  expectedAcreage: true,
  actualAcreage: true,
  createdAt: true,
  updatedAt: true,
  lead: {
    select: {
      farmerName: true,
      farmerPhone: true,
      farmerAddress: true,
      latitude: true,
      longitude: true,
      acreageDecimal: true,
      cropType: true,
      notes: true,
      status: true,
      farmLocation: {
        select: { addressText: true, plusCode: true, latitude: true, longitude: true },
      },
      crop: { select: { displayName: true } },
      matchedCenter: { select: { id: true, code: true, name: true } },
    },
  },
  pilot: { select: { id: true, name: true } },
  copilot: { select: { id: true, name: true } },
  drone: { select: { id: true, name: true, model: true, serialNumber: true } },
  lmv: { select: { id: true, registrationNo: true, label: true } },
};

function mobileAssignmentError(message, code = 'VALIDATION_FAILED', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function parseTimestamp(value, name) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.valueOf())) {
    throw mobileAssignmentError(`${name} must be a valid timestamp`);
  }
  return parsed;
}

function boundedWindow({ from, to, now = new Date() }) {
  const start = from ? parseTimestamp(from, 'from') : new Date(now.getTime() - 24 * 60 * 60_000);
  const end = to ? parseTimestamp(to, 'to') : new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  if (end <= start || end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
    throw mobileAssignmentError(`Assignment window must be positive and no longer than ${MAX_RANGE_DAYS} days`);
  }
  const earliest = new Date(now.getTime() - TERMINAL_RETENTION_DAYS * 24 * 60 * 60_000);
  const latest = new Date(now.getTime() + FUTURE_HORIZON_DAYS * 24 * 60 * 60_000);
  if (start < earliest || end > latest) {
    throw mobileAssignmentError('Assignment window is outside the mobile retention horizon');
  }
  return { start, end };
}

function decimal(value) {
  if (value === null || typeof value === 'undefined') return null;
  return Number(value).toFixed(2);
}

function serviceWindow(assignment) {
  const start = assignment.serviceWindowStart || assignment.scheduledDate;
  return {
    start,
    end: assignment.serviceWindowEnd || new Date(start.getTime() + 120 * 60_000),
  };
}

function allowedActions(assignment, actorId) {
  if (assignment.lead.status === 'SCHEDULED'
    && assignment.crewFormationState === 'PENDING_COPILOT_SELECTION'
    && assignment.pilotId === actorId) {
    return ['SELECT_COPILOT'];
  }
  return [];
}

function project(assignment, actorId) {
  const location = assignment.lead.farmLocation;
  const latitude = location?.latitude === null || typeof location?.latitude === 'undefined'
    ? assignment.lead.latitude : Number(location.latitude);
  const longitude = location?.longitude === null || typeof location?.longitude === 'undefined'
    ? assignment.lead.longitude : Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw mobileAssignmentError('Assigned farm location is incomplete', 'ASSIGNMENT_LOCATION_INCOMPLETE', 409);
  }
  const window = serviceWindow(assignment);
  const crew = [{ id: assignment.pilot.id, displayName: assignment.pilot.name, crewRole: 'PRIMARY_PILOT' }];
  if (assignment.copilot) {
    crew.push({ id: assignment.copilot.id, displayName: assignment.copilot.name, crewRole: 'COPILOT' });
  }
  const notes = String(assignment.lead.notes || '').trim();
  return {
    id: assignment.id,
    leadId: assignment.leadId,
    revision: assignment.revision,
    status: assignment.lead.status,
    crewFormationState: assignment.crewFormationState,
    dailySequence: assignment.dailySequence,
    serviceWindowStart: window.start.toISOString(),
    serviceWindowEnd: window.end.toISOString(),
    farmer: { displayName: assignment.lead.farmerName, operationalPhone: assignment.lead.farmerPhone },
    farm: {
      displayAddress: location?.addressText || assignment.lead.farmerAddress || 'Assigned farm',
      plusCode: location?.plusCode || null,
      latitude,
      longitude,
    },
    crop: assignment.lead.crop?.displayName || assignment.lead.cropType || null,
    expectedAcreage: decimal(assignment.lead.acreageDecimal ?? assignment.expectedAcreage),
    actualAcreage: decimal(assignment.actualAcreage),
    crew,
    drone: {
      id: assignment.drone.id,
      code: assignment.drone.name || assignment.drone.model,
      serialNumber: assignment.drone.serialNumber,
    },
    lmv: assignment.lmv ? {
      id: assignment.lmv.id,
      registrationNumber: assignment.lmv.registrationNo,
      label: assignment.lmv.label,
    } : null,
    operatingCenter: assignment.lead.matchedCenter ? {
      id: assignment.lead.matchedCenter.id,
      code: assignment.lead.matchedCenter.code || assignment.lead.matchedCenter.id,
      displayName: assignment.lead.matchedCenter.name,
    } : null,
    operationalNotes: notes ? [notes.slice(0, 500)] : [],
    updatedAt: assignment.updatedAt.toISOString(),
    allowedActions: allowedActions(assignment, actorId),
  };
}

async function listForPilot({ pilotId, from, to, now = new Date() }) {
  const window = boundedWindow({ from, to, now });
  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [{ pilotId }, { copilotId: pilotId }],
      scheduledDate: { gte: window.start, lt: window.end },
    },
    select: assignmentSelect,
    orderBy: [{ scheduledDate: 'asc' }, { dailySequence: 'asc' }, { id: 'asc' }],
    take: MAX_LIST_ITEMS,
  });
  return assignments.map((assignment) => project(assignment, pilotId));
}

async function findForPilot({ assignmentId, pilotId, now = new Date() }) {
  const earliest = new Date(now.getTime() - TERMINAL_RETENTION_DAYS * 24 * 60 * 60_000);
  const latest = new Date(now.getTime() + FUTURE_HORIZON_DAYS * 24 * 60 * 60_000);
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      OR: [{ pilotId }, { copilotId: pilotId }],
      scheduledDate: { gte: earliest, lte: latest },
      NOT: { AND: [{ lead: { status: { in: TERMINAL_STATUSES } } }, { updatedAt: { lt: earliest } }] },
    },
    select: assignmentSelect,
  });
  if (!assignment) throw mobileAssignmentError('Assignment not found', 'RESOURCE_NOT_FOUND', 404);
  return project(assignment, pilotId);
}

module.exports = {
  MAX_LIST_ITEMS,
  boundedWindow,
  findForPilot,
  listForPilot,
  mobileAssignmentError,
  project,
};
