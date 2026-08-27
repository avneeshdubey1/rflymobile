const prisma = require('../lib/prisma');
const { sanitizeAuditReason, sanitizeAuditState } = require('./auditLogRepository');
const { setHistoryActor } = require('./historyActorRepository');

const activeLeadStatuses = ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'];
const overrideRoles = new Set(['ADMIN']);

function crewError(message, code, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

async function serializable(execute, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(execute, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' && attempt < attempts - 1) continue;
      if (error.code === 'P2034') {
        throw crewError(
          'Crew formation changed concurrently. Refresh the assignment and retry.',
          'CREW_FORMATION_RETRY_EXHAUSTED',
        );
      }
      throw error;
    }
  }
  throw crewError('Crew formation could not be serialized', 'CREW_FORMATION_RETRY_EXHAUSTED');
}

async function lockKeys(transaction, keys) {
  for (const key of [...new Set(keys.filter(Boolean).map(String))].sort()) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
  }
}

function assignmentWindow(assignment) {
  const start = assignment.serviceWindowStart || assignment.scheduledDate;
  const end = assignment.serviceWindowEnd || new Date(start.getTime() + 120 * 60_000);
  return { start, end };
}

function assertFormationOpen(assignment, now) {
  if (!assignment) throw crewError('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
  if (assignment.legacyCrewIncomplete || assignment.crewFormationState === 'LEGACY_INCOMPLETE') {
    throw crewError('Legacy incomplete assignments require Fleet review', 'LEGACY_CREW_REVIEW_REQUIRED');
  }
  if (assignment.startedAt || assignment.completedAt || !['SCHEDULED', 'PILOT_ACCEPTED'].includes(assignment.lead.status)) {
    throw crewError('Copilot cannot be changed after the mission starts or closes', 'COPILOT_REPLACEMENT_CLOSED');
  }
  const { start } = assignmentWindow(assignment);
  if (start <= now) {
    throw crewError('The Copilot-selection deadline has passed', 'COPILOT_SELECTION_DEADLINE_PASSED');
  }
}

function assertExpectedRevision(assignment, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw crewError('A positive assignment revision is required', 'ASSIGNMENT_REVISION_REQUIRED');
  }
  if (assignment.revision !== expectedRevision) {
    throw crewError('Assignment changed. Refresh before selecting a Copilot.', 'ASSIGNMENT_REVISION_CONFLICT', {
      currentRevision: assignment.revision,
    });
  }
}

async function findCandidateConflict(transaction, assignment, candidateId) {
  const window = assignmentWindow(assignment);
  return transaction.assignment.findFirst({
    where: {
      id: { not: assignment.id },
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
      OR: [{ pilotId: candidateId }, { copilotId: candidateId }],
    },
    select: { id: true },
  });
}

function assertCandidateProfile(assignment, candidate) {
  if (!candidate || candidate.role !== 'PILOT' || !candidate.active || candidate.archivedAt
    || candidate.pilotAvailabilityState !== 'AVAILABLE') {
    throw crewError('The selected Copilot is not an active Pilot', 'COPILOT_NOT_ELIGIBLE');
  }
  if (candidate.id === assignment.pilotId) {
    throw crewError('Primary Pilot and Copilot must be different people', 'COPILOT_SELF_SELECTION');
  }
  if (!assignment.lead.matchedCenterId || candidate.homeCenterId !== assignment.lead.matchedCenterId) {
    throw crewError('The selected Copilot must belong to the assignment operating centre', 'COPILOT_CROSS_CENTRE');
  }
  const { start } = assignmentWindow(assignment);
  if (candidate.pilotLicenseExpiry && candidate.pilotLicenseExpiry <= start) {
    throw crewError('The selected Copilot licence is expired for the assignment', 'COPILOT_LICENCE_EXPIRED');
  }
}

async function assertCandidateEligible(transaction, assignment, candidateId) {
  const candidate = await transaction.user.findUnique({ where: { id: candidateId } });
  assertCandidateProfile(assignment, candidate);
  if (await findCandidateConflict(transaction, assignment, candidate.id)) {
    throw crewError('The selected Copilot has an overlapping assignment', 'COPILOT_SCHEDULE_CONFLICT');
  }
  return candidate;
}

function candidateProjection(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    employeeCode: candidate.employeeCode,
    homeCenterId: candidate.homeCenterId,
  };
}

async function listEligibleCopilots({ assignmentId, actorId, now = new Date() }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { lead: { select: { status: true, matchedCenterId: true } } },
  });
  assertFormationOpen(assignment, now);
  if (assignment.pilotId !== actorId) {
    throw crewError('Only the assigned Primary Pilot can choose a Copilot', 'PRIMARY_PILOT_REQUIRED');
  }
  if (assignment.crewFormationState !== 'PENDING_COPILOT_SELECTION') {
    throw crewError('This assignment is not awaiting Copilot selection', 'CREW_FORMATION_NOT_PENDING');
  }

  const candidates = await prisma.user.findMany({
    where: {
      role: 'PILOT',
      active: true,
      archivedAt: null,
      pilotAvailabilityState: 'AVAILABLE',
      homeCenterId: assignment.lead.matchedCenterId,
      id: { not: assignment.pilotId },
      OR: [{ pilotLicenseExpiry: null }, { pilotLicenseExpiry: { gt: assignmentWindow(assignment).start } }],
    },
    select: { id: true, name: true, employeeCode: true, homeCenterId: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  const conflicts = await Promise.all(candidates.map((candidate) => findCandidateConflict(prisma, assignment, candidate.id)));
  return candidates.filter((_, index) => !conflicts[index]).map(candidateProjection);
}

async function listEligibleCopilotsForStaff({ assignmentId, actorId, now = new Date() }) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true, active: true, archivedAt: true },
  });
  if (!actor || !actor.active || actor.archivedAt || !overrideRoles.has(actor.role)) {
    throw crewError('Only an active Admin may override a Copilot', 'CREW_OVERRIDE_FORBIDDEN');
  }
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { lead: { select: { status: true, matchedCenterId: true } } },
  });
  assertFormationOpen(assignment, now);
  const candidates = await prisma.user.findMany({
    where: {
      role: 'PILOT',
      active: true,
      archivedAt: null,
      pilotAvailabilityState: 'AVAILABLE',
      homeCenterId: assignment.lead.matchedCenterId,
      id: { not: assignment.pilotId },
      OR: [{ pilotLicenseExpiry: null }, { pilotLicenseExpiry: { gt: assignmentWindow(assignment).start } }],
    },
    select: { id: true, name: true, employeeCode: true, homeCenterId: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  const conflicts = await Promise.all(candidates.map((candidate) => findCandidateConflict(prisma, assignment, candidate.id)));
  return candidates.filter((_, index) => !conflicts[index]).map(candidateProjection);
}

async function writeFormationAudit(transaction, { assignment, candidateId, actorId, action, reason }) {
  return transaction.auditLog.create({
    data: {
      entityType: 'Assignment',
      entityId: assignment.id,
      action,
      actorId,
      beforeState: sanitizeAuditState({
        copilotId: assignment.copilotId,
        crewFormationState: assignment.crewFormationState,
        revision: assignment.revision,
      }),
      afterState: sanitizeAuditState({
        copilotId: candidateId,
        crewFormationState: 'READY',
        revision: assignment.revision + 1,
      }),
      reason: sanitizeAuditReason(reason),
    },
  });
}

async function formCrew({
  assignmentId,
  candidateId,
  actorId,
  expectedRevision,
  override = false,
  reason = null,
  now = new Date(),
}) {
  return serializable(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    await lockKeys(transaction, [`assignment:${assignmentId}`, `pilot:${candidateId}`]);
    const assignment = await transaction.assignment.findUnique({
      where: { id: assignmentId },
      include: { lead: { select: { id: true, status: true, matchedCenterId: true } } },
    });
    assertFormationOpen(assignment, now);
    assertExpectedRevision(assignment, expectedRevision);

    let action = 'COPILOT_SELECTED_BY_PRIMARY';
    let auditReason = null;
    if (override) {
      const actor = await transaction.user.findUnique({
        where: { id: actorId },
        select: { role: true, active: true, archivedAt: true },
      });
      if (!actor || !actor.active || actor.archivedAt || !overrideRoles.has(actor.role)) {
        throw crewError('Only an active Admin may override a Copilot', 'CREW_OVERRIDE_FORBIDDEN');
      }
      auditReason = String(reason || '').trim();
      if (!auditReason) throw crewError('A reason is required for Copilot override', 'CREW_OVERRIDE_REASON_REQUIRED');
      action = 'COPILOT_OVERRIDDEN';
    } else {
      if (assignment.pilotId !== actorId) {
        throw crewError('Only the assigned Primary Pilot can choose a Copilot', 'PRIMARY_PILOT_REQUIRED');
      }
      if (assignment.crewFormationState !== 'PENDING_COPILOT_SELECTION') {
        throw crewError('This assignment is not awaiting Copilot selection', 'CREW_FORMATION_NOT_PENDING');
      }
    }

    const candidate = await assertCandidateEligible(transaction, assignment, candidateId);
    const updated = await transaction.assignment.updateMany({
      where: { id: assignment.id, revision: expectedRevision },
      data: {
        copilotId: candidate.id,
        crewFormationState: 'READY',
        copilotSelectedAt: now,
        crewFormationUpdatedAt: now,
        legacyCrewIncomplete: false,
        acceptedAt: override && assignment.acceptedAt ? null : assignment.acceptedAt,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw crewError('Assignment changed. Refresh before selecting a Copilot.', 'ASSIGNMENT_REVISION_CONFLICT');
    }
    if (override && assignment.acceptedAt) {
      await transaction.lead.update({ where: { id: assignment.lead.id }, data: { status: 'SCHEDULED' } });
    }
    await writeFormationAudit(transaction, {
      assignment,
      candidateId: candidate.id,
      actorId,
      action,
      reason: auditReason,
    });
    await transaction.notification.create({
      data: {
        type: 'PILOT_ASSIGNMENT',
        recipientId: candidate.id,
        leadId: assignment.lead.id,
        message: `You were selected as Copilot for assignment ${assignment.id}.`,
      },
    });
    const configuredTimers = (process.env.NOTIFICATION_CASCADE_TIMERS_MS || '')
      .split(',').map(Number).filter(Number.isFinite);
    const timers = configuredTimers.length === 4
      ? configuredTimers
      : [0, 15 * 60_000, 45 * 60_000, 2 * 60 * 60_000];
    await transaction.notificationEscalation.upsert({
      where: { assignmentId: assignment.id },
      create: {
        assignmentId: assignment.id,
        stage: 'PUSH_SENT',
        nextActionAt: new Date(now.getTime() + timers[1]),
      },
      update: {
        stage: 'PUSH_SENT',
        nextActionAt: new Date(now.getTime() + timers[1]),
        reassignCount: 0,
        closedAt: null,
      },
    });
    return transaction.assignment.findUnique({
      where: { id: assignment.id },
      include: {
        lead: true,
        pilot: { select: { id: true, name: true, employeeCode: true, homeCenterId: true } },
        copilot: { select: { id: true, name: true, employeeCode: true, homeCenterId: true } },
        drone: true,
        lmv: true,
      },
    });
  });
}

function selectCopilot(input) {
  return formCrew({ ...input, override: false });
}

function overrideCopilot(input) {
  return formCrew({ ...input, override: true });
}

module.exports = {
  listEligibleCopilots,
  listEligibleCopilotsForStaff,
  selectCopilot,
  overrideCopilot,
};
