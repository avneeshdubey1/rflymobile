const leadRepository = require('../src/repositories/leadRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const geofenceService = require('./geofenceService');
const whatsappService = require('./whatsappService');
const i18nService = require('./i18nService');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');
const autoAssignmentService = require('./autoAssignmentService');
const logger = require('./loggerService');

function isCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) throw new Error('Enter a valid phone number using digits only');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new Error('Phone number must contain between 7 and 15 digits');
  return raw.startsWith('+') ? `+${digits}` : digits;
}

async function validateAcreage(value) {
  const acreage = Number(value);
  if (!Number.isFinite(acreage) || acreage <= 0) throw new Error('Acreage must be a positive number');
  const maximum = await pricingConfigRepository.findByKey('MAX_LEAD_ACREAGE');
  if (!maximum || !Number.isFinite(maximum.value) || maximum.value <= 0) throw new Error('The maximum acreage configuration is unavailable; contact operations');
  if (acreage > maximum.value) throw new Error(`Acreage must not exceed ${maximum.value}`);
  return acreage;
}

async function createLead(input) {
  const { farmerName, farmerPhone, acreage, intakeChannel, latitude, longitude, preferredLanguage = 'ta', ...optional } = input;
  const normalizedName = String(farmerName || '').trim();
  if (normalizedName.length < 2 || normalizedName.length > 120) throw new Error('Farmer name must contain between 2 and 120 characters');
  const normalizedPhone = normalizePhone(farmerPhone);
  const normalizedAcreage = await validateAcreage(acreage);
  if (!['WEBSITE', 'GOOGLE_FORM', 'MANUAL_SALES'].includes(intakeChannel)) throw new Error('A valid intake channel is required');
  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) throw new Error('A valid latitude and longitude are required for geofencing');

  let status = 'NEW';
  let addedNotes = [];

  if (optional.waterBodyNearby === true) {
    status = 'FLAGGED';
    addedNotes.push('REQUIRES BUFFER ZONE REVIEW');
  }

  if (optional.terrainType === 'Mountainous') {
    status = 'FLAGGED';
    addedNotes.push('HIGH TERRAIN RISK');
  }

  if (optional.hasChemical === false) {
    addedNotes.push(`COMPANY PROCUREMENT NEEDED: ${optional.chemicalBrand || 'Unknown brand'}`);
  } else if (optional.hasChemical === true && !optional.chemicalProofUrl) {
    status = 'MANUAL_CALL_REQUIRED';
  }

  if (optional.expectedDate) {
    const sprayDate = new Date(optional.expectedDate);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    if (sprayDate > maxDate) {
      throw new Error('Expected date cannot be more than 3 months in advance');
    }
    optional.expectedDate = sprayDate;
  }

  const geofence = await geofenceService.evaluate(latitude, longitude);
  
  if (intakeChannel === 'MANUAL_SALES') {
    status = 'PROCESSED';
  } else if (geofence.matchedCenter) {
    if (status === 'NEW') status = 'PROCESSED';
  } else {
    status = 'OUT_OF_RANGE';
    addedNotes.push(`Geofence failed. Distance from nearest center: ${geofence.distanceKm ? geofence.distanceKm.toFixed(2) : 'N/A'}km`);
  }

  const newNotes = [optional.notes, ...addedNotes].filter(Boolean).join('\n');
  
  delete optional.status;
  delete optional.processedAt;
  delete optional.notes;
  delete optional.mapsLink;
  delete optional.phone;
  delete optional.acres;
  delete optional.village;

  const lead = await leadRepository.create({
    farmerName: normalizedName, farmerPhone: normalizedPhone, acreage: normalizedAcreage, intakeChannel, latitude, longitude,
    status, matchedCenterId: geofence.matchedCenter?.id || null, distanceFromCenterKm: geofence.distanceKm,
    notes: newNotes,
    processedAt: status === 'PROCESSED' ? new Date() : null, preferredLanguage: i18nService.normalizeLanguage(preferredLanguage), ...optional,
  });
  
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'CREATED', afterState: lead });
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'GEOFENCE_CHECKED', afterState: { status, matchedCenterId: lead.matchedCenterId, distanceFromCenterKm: lead.distanceFromCenterKm } });
  if (status === 'PROCESSED') await whatsappService.sendForStatus(lead, 'PROCESSED');

  const appealOffer = status === 'OUT_OF_RANGE' ? await geofenceService.suggestedAppealFee(geofence.distanceKm, geofence.nearestCenter) : null;
  return { lead, geofence, appealOffer };
}

async function triggerAutoAssignment(leadId) {
  try {
    return await autoAssignmentService.autoAssignProcessedLead(leadId);
  } catch (err) {
    logger.error('Failed to trigger auto assignment from intake', err);
    return null;
  }
}

module.exports = { createLead, triggerAutoAssignment };
