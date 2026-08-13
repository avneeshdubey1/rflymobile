const prisma = require('../lib/prisma');

const MAX_RANGE_DAYS = 14;
const MAX_SCHEDULE_ITEMS = 200;
const MAX_EXCEPTION_ITEMS = 100;

function operationsError(message, code = 'VALIDATION_FAILED', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function parseBoundedWindow({ from, to, now = new Date() }) {
  const start = new Date(from);
  const end = new Date(to);
  if (!from || !to || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
    throw operationsError('Valid from and to timestamps are required');
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
    throw operationsError(`Schedule range must not exceed ${MAX_RANGE_DAYS} days`);
  }
  const earliest = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  const latest = new Date(now.getTime() + 90 * 24 * 60 * 60_000);
  if (start < earliest || end > latest) throw operationsError('Schedule range is outside the Operations horizon');
  return { start, end };
}

const assignmentSelect = {
  id: true,
  revision: true,
  crewFormationState: true,
  dailySequence: true,
  scheduledDate: true,
  serviceWindowStart: true,
  serviceWindowEnd: true,
  issueCategory: true,
  lead: {
    select: {
      id: true,
      farmerName: true,
      status: true,
      acreageDecimal: true,
      cropType: true,
      crop: { select: { displayName: true } },
      matchedCenter: { select: { id: true, code: true, name: true } },
    },
  },
  pilot: { select: { id: true, name: true, employeeCode: true } },
  copilot: { select: { id: true, name: true, employeeCode: true } },
  drone: { select: { id: true, name: true, model: true, serialNumber: true, status: true } },
  lmv: { select: { id: true, registrationNo: true, label: true, status: true } },
};

function decimal(value) {
  return value === null || typeof value === 'undefined' ? null : Number(value).toFixed(2);
}

function assignmentWindow(assignment) {
  const start = assignment.serviceWindowStart || assignment.scheduledDate;
  return {
    start: start.toISOString(),
    end: (assignment.serviceWindowEnd || new Date(start.getTime() + 120 * 60_000)).toISOString(),
  };
}

function crewMember(user) {
  return user ? { id: user.id, displayName: user.name, employeeCode: user.employeeCode } : null;
}

function projectSchedule(assignment) {
  return {
    id: assignment.id,
    leadId: assignment.lead.id,
    revision: assignment.revision,
    status: assignment.lead.status,
    crewFormationState: assignment.crewFormationState,
    dailySequence: assignment.dailySequence,
    serviceWindow: assignmentWindow(assignment),
    farmerDisplayName: assignment.lead.farmerName,
    crop: assignment.lead.crop?.displayName || assignment.lead.cropType || null,
    expectedAcreage: decimal(assignment.lead.acreageDecimal),
    operatingCenter: assignment.lead.matchedCenter ? {
      id: assignment.lead.matchedCenter.id,
      code: assignment.lead.matchedCenter.code || assignment.lead.matchedCenter.id,
      displayName: assignment.lead.matchedCenter.name,
    } : null,
    crew: { primaryPilot: crewMember(assignment.pilot), copilot: crewMember(assignment.copilot) },
    drone: {
      id: assignment.drone.id,
      code: assignment.drone.name || assignment.drone.model,
      serialNumber: assignment.drone.serialNumber,
      status: assignment.drone.status,
    },
    lmv: assignment.lmv ? {
      id: assignment.lmv.id,
      registrationNumber: assignment.lmv.registrationNo,
      label: assignment.lmv.label,
      status: assignment.lmv.status,
    } : null,
    issueCategory: assignment.issueCategory,
  };
}

function exceptionCodes(assignment) {
  const codes = [];
  if (assignment.crewFormationState === 'PENDING_COPILOT_SELECTION') codes.push('COPILOT_SELECTION_PENDING');
  if (assignment.crewFormationState === 'LEGACY_INCOMPLETE') codes.push('LEGACY_CREW_REVIEW_REQUIRED');
  if (!assignment.lmv) codes.push('LMV_REQUIRED');
  if (assignment.issueCategory) codes.push('MISSION_ISSUE_REPORTED');
  return codes;
}

async function listSchedule({ from, to, now }) {
  const window = parseBoundedWindow({ from, to, now });
  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [
        { serviceWindowStart: { lt: window.end }, serviceWindowEnd: { gt: window.start } },
        { serviceWindowStart: null, scheduledDate: { gte: window.start, lt: window.end } },
      ],
    },
    select: assignmentSelect,
    orderBy: [{ scheduledDate: 'asc' }, { dailySequence: 'asc' }, { id: 'asc' }],
    take: MAX_SCHEDULE_ITEMS,
  });
  return { from: window.start.toISOString(), to: window.end.toISOString(), assignments: assignments.map(projectSchedule) };
}

async function listExceptions({ from, to, now }) {
  const window = parseBoundedWindow({ from, to, now });
  const [assignments, leads] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        OR: [
          { crewFormationState: { in: ['PENDING_COPILOT_SELECTION', 'LEGACY_INCOMPLETE'] } },
          { issueCategory: { not: null } },
          { lmvId: null },
        ],
        scheduledDate: { gte: window.start, lt: window.end },
        lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
      },
      select: assignmentSelect,
      orderBy: [{ scheduledDate: 'asc' }, { dailySequence: 'asc' }, { id: 'asc' }],
      take: MAX_EXCEPTION_ITEMS,
    }),
    prisma.lead.findMany({
      where: { status: 'NEEDS_MANUAL_SCHEDULING', createdAt: { lt: window.end } },
      select: {
        id: true,
        farmerName: true,
        acreageDecimal: true,
        cropType: true,
        createdAt: true,
        matchedCenter: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_EXCEPTION_ITEMS,
    }),
  ]);
  return {
    from: window.start.toISOString(),
    to: window.end.toISOString(),
    exceptions: [
      ...assignments.map((assignment) => ({
        type: 'ASSIGNMENT',
        id: assignment.id,
        codes: exceptionCodes(assignment),
        assignment: projectSchedule(assignment),
        lead: null,
      })),
      ...leads.map((lead) => ({
        type: 'UNSCHEDULED_LEAD',
        id: lead.id,
        codes: ['NEEDS_MANUAL_SCHEDULING'],
        assignment: null,
        lead: {
          id: lead.id,
          farmerDisplayName: lead.farmerName,
          expectedAcreage: decimal(lead.acreageDecimal),
          crop: lead.cropType,
          createdAt: lead.createdAt.toISOString(),
          operatingCenter: lead.matchedCenter ? {
            id: lead.matchedCenter.id,
            code: lead.matchedCenter.code || lead.matchedCenter.id,
            displayName: lead.matchedCenter.name,
          } : null,
        },
      })),
    ].slice(0, MAX_EXCEPTION_ITEMS),
  };
}

module.exports = { listExceptions, listSchedule, operationsError, parseBoundedWindow, projectSchedule };
