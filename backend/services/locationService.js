const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogService = require('./auditLogService');

const LIVE_STATUSES = new Set(['PILOT_ACCEPTED', 'IN_PROGRESS']);
const WATCHER_ROLES = new Set(['ADMIN', 'FLEET_MANAGER']);

function asCoordinate(value, min, max, name) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw new Error(`${name} must be a valid coordinate`);
  }
  return coordinate;
}

function locationPayload(assignment) {
  return {
    assignmentId: assignment.id,
    latitude: assignment.lastKnownLat,
    longitude: assignment.lastKnownLng,
    lastPingAt: assignment.lastPingAt,
  };
}

async function requireAssignment(id) {
  const assignment = await assignmentRepository.findById(id);
  if (!assignment) throw new Error('Assignment not found');
  return assignment;
}

async function recordLocation(assignmentId, actor, latitude, longitude) {
  if (actor?.role !== 'PILOT') throw new Error('Only the assigned pilot can send location updates');
  const assignment = await requireAssignment(assignmentId);
  if (![assignment.pilotId, assignment.copilotId].filter(Boolean).includes(actor.userId)) throw new Error('This assignment is not assigned to you');
  if (!LIVE_STATUSES.has(assignment.lead.status)) throw new Error('Location updates are available only after acceptance and before completion');

  const lat = asCoordinate(latitude, -90, 90, 'Latitude');
  const lng = asCoordinate(longitude, -180, 180, 'Longitude');
  const updated = await assignmentRepository.update(assignment.id, {
    lastKnownLat: lat,
    lastKnownLng: lng,
    lastPingAt: new Date(),
  });
  const payload = locationPayload(updated);
  await auditLogService.record({
    entityType: 'Assignment',
    entityId: updated.id,
    action: 'GPS_LOCATION_UPDATED',
    actorId: actor.userId,
    afterState: {
      assignmentId: updated.id,
      lastPingAt: updated.lastPingAt,
      locationRecorded: true,
    },
  });
  return payload;
}

async function getLocation(assignmentId, actor) {
  if (!WATCHER_ROLES.has(actor?.role)) throw new Error('Only Fleet Managers and Admins can view pilot locations');
  return locationPayload(await requireAssignment(assignmentId));
}

module.exports = { recordLocation, getLocation };
