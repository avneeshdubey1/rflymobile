const prisma = require('../lib/prisma');
const { sanitizeAuditState } = require('./auditLogRepository');

const ACTIVE_LEAD_STATUSES = ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'];

function availabilityError(message, code, status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function updateForPilot({ pilotId, state }) {
  if (!['AVAILABLE', 'OFFLINE'].includes(state)) {
    throw availabilityError('Availability must be AVAILABLE or OFFLINE', 'VALIDATION_FAILED', 400);
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pilot:${pilotId}`}, 0))::text AS locked`;
    const pilot = await transaction.user.findUnique({ where: { id: pilotId } });
    if (!pilot || pilot.role !== 'PILOT' || !pilot.active || pilot.archivedAt) {
      throw availabilityError('An active Pilot account is required', 'ROLE_NOT_ALLOWED', 403);
    }
    if (pilot.pilotAvailabilityState === state) return pilot;

    if (state === 'OFFLINE') {
      const activeAssignments = await transaction.assignment.count({
        where: {
          OR: [{ pilotId }, { copilotId: pilotId }],
          lead: { status: { in: ACTIVE_LEAD_STATUSES } },
        },
      });
      if (activeAssignments > 0) {
        throw availabilityError(
          'Finish or have Fleet reassign active work before going offline',
          'ACTIVE_ASSIGNMENT_BLOCKS_OFFLINE',
        );
      }
    }

    const updated = await transaction.user.update({
      where: { id: pilot.id },
      data: { pilotAvailabilityState: state },
    });
    await transaction.auditLog.create({
      data: {
        entityType: 'User',
        entityId: pilot.id,
        action: 'PILOT_AVAILABILITY_UPDATED',
        actorId: pilot.id,
        beforeState: sanitizeAuditState({ pilotAvailabilityState: pilot.pilotAvailabilityState }),
        afterState: sanitizeAuditState({ pilotAvailabilityState: updated.pilotAvailabilityState }),
      },
    });
    return updated;
  }, { isolationLevel: 'Serializable' });
}

module.exports = { updateForPilot };
