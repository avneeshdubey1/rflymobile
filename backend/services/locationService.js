const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogService = require('./auditLogService');

const LIVE_STATUSES = new Set(['PILOT_ACCEPTED', 'IN_PROGRESS']);
const WATCHER_ROLES = new Set(['ADMIN', 'FLEET_MANAGER']);

function locationError(message, code = 'LOCATION_NOT_ALLOWED', status = 409, details) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (details) error.details = details;
  return error;
}

function asCoordinate(value, min, max, name) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw locationError(`${name} must be a valid coordinate`, 'LOCATION_INVALID', 400);
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
  if (!assignment) throw locationError('Assignment not found', 'RESOURCE_NOT_FOUND', 404);
  return assignment;
}

async function recordLocation(assignmentId, actor, latitude, longitude, options = {}) {
  if (actor?.role !== 'PILOT') throw locationError('Only the assigned pilot can send location updates', 'ROLE_NOT_ALLOWED', 403);
  const assignment = await requireAssignment(assignmentId);
  if (![assignment.pilotId, assignment.copilotId].filter(Boolean).includes(actor.userId)) {
    throw locationError('This assignment is not assigned to you');
  }
  const crewMember = assignment.pilotId === actor.userId ? assignment.pilot : assignment.copilot;
  if (!crewMember?.active || crewMember.archivedAt || crewMember.pilotAvailabilityState !== 'AVAILABLE') {
    throw locationError('Pilot availability does not permit location updates');
  }
  if (!LIVE_STATUSES.has(assignment.lead.status)) {
    throw locationError('Location updates are available only after acceptance and before completion');
  }

  const lat = asCoordinate(latitude, -90, 90, 'Latitude');
  const lng = asCoordinate(longitude, -180, 180, 'Longitude');
  const accuracyMetres = typeof options.accuracyMetres === 'undefined' ? null : Number(options.accuracyMetres);
  const maximumAccuracyMetres = options.maximumAccuracyMetres || 100;
  if (accuracyMetres !== null && (!Number.isFinite(accuracyMetres) || accuracyMetres < 0 || accuracyMetres > maximumAccuracyMetres)) {
    throw locationError(`Location accuracy must be within ${maximumAccuracyMetres} metres`, 'LOCATION_INVALID', 400);
  }
  const capturedAt = options.capturedAt ? new Date(options.capturedAt) : new Date();
  const now = options.now || new Date();
  if (Number.isNaN(capturedAt.valueOf())
    || capturedAt < new Date(now.getTime() - (options.maximumAgeMs || 5 * 60_000))
    || capturedAt > new Date(now.getTime() + (options.futureSkewMs || 2 * 60_000))) {
    throw locationError('Location sample timestamp is outside the accepted window', 'LOCATION_INVALID', 400);
  }
  if (assignment.lastPingAt && capturedAt <= assignment.lastPingAt) return locationPayload(assignment);
  const intervalMs = options.intervalSeconds ? options.intervalSeconds * 1000 : 0;
  if (intervalMs > 0 && assignment.lastPingAt && now.getTime() - assignment.lastPingAt.getTime() < intervalMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((intervalMs - (now.getTime() - assignment.lastPingAt.getTime())) / 1000));
    throw locationError('Location updates are arriving too quickly', 'RATE_LIMITED', 429, { retryAfterSeconds });
  }
  const updated = await assignmentRepository.update(assignment.id, {
    lastKnownLat: lat,
    lastKnownLng: lng,
    lastPingAt: capturedAt,
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
  if (!WATCHER_ROLES.has(actor?.role)) throw locationError('Only Fleet Managers and Admins can view pilot locations', 'ROLE_NOT_ALLOWED', 403);
  const assignment = await requireAssignment(assignmentId);
  if (!LIVE_STATUSES.has(assignment.lead.status)) {
    throw locationError('Live location is available only for accepted or in-progress missions');
  }
  return locationPayload(assignment);
}

module.exports = { locationError, recordLocation, getLocation };
