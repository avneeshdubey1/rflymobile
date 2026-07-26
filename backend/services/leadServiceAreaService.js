const leadRepository = require('../src/repositories/leadRepository');
const auditLogService = require('./auditLogService');
const geofenceService = require('./geofenceService');

class ServiceAreaValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ServiceAreaValidationError';
    this.code = code;
  }
}

function hasCoordinates(lead) {
  return Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude);
}

// Accepted Leads retain their operational location. Recheck it immediately
// before any scheduling path so a legacy record or changed service area cannot
// turn into a dispatch exception.
async function revalidateForScheduling(lead, { actorId = null } = {}) {
  if (!hasCoordinates(lead)) {
    throw new ServiceAreaValidationError('The request requires service-area revalidation before scheduling', 'SERVICE_AREA_REVALIDATION_REQUIRED');
  }

  const geofence = await geofenceService.evaluate(lead.latitude, lead.longitude);
  if (!geofence.matchedCenter) {
    throw new ServiceAreaValidationError('The active service area no longer covers this request', 'SERVICE_AREA_REVALIDATION_FAILED');
  }

  const distanceChanged = !Number.isFinite(lead.distanceFromCenterKm)
    || Math.abs(lead.distanceFromCenterKm - geofence.distanceKm) > 0.000001;
  if (lead.matchedCenterId === geofence.matchedCenter.id && !distanceChanged) {
    return lead;
  }

  const updated = await leadRepository.update(lead.id, {
    matchedCenterId: geofence.matchedCenter.id,
    distanceFromCenterKm: geofence.distanceKm,
  });
  await auditLogService.record({
    entityType: 'Lead',
    entityId: updated.id,
    action: 'SERVICE_AREA_REVALIDATED',
    actorId,
    beforeState: { matchedCenterId: lead.matchedCenterId },
    afterState: { matchedCenterId: updated.matchedCenterId },
  });
  return updated;
}

module.exports = { ServiceAreaValidationError, revalidateForScheduling };
