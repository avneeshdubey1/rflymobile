const leadRepository = require('../src/repositories/leadRepository');
const auditLogService = require('./auditLogService');
const geofenceService = require('./geofenceService');
const declinedEnquiryService = require('./declinedEnquiryService');
const i18nService = require('./i18nService');
const { normalizePhone } = require('./identityService');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');
const autoAssignmentService = require('./autoAssignmentService');
const logger = require('./loggerService');

const ACCEPTED_CHANNELS = new Set(['WEBSITE', 'MANUAL_SALES']);
const MAX_TEXT_LENGTH = 120;

function isCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function optionalText(value, field, { maximum = MAX_TEXT_LENGTH } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw new Error(`${field} must not exceed ${maximum} characters`);
  return normalized;
}

function optionalBoolean(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false`);
  return value;
}

function optionalInteger(value, field, { minimum = 0, maximum = 520 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${field} must be a whole number between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function optionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Expected date is invalid');
  const maximum = new Date();
  maximum.setMonth(maximum.getMonth() + 3);
  if (parsed > maximum) throw new Error('Expected date cannot be more than 3 months in advance');
  return parsed;
}

async function validateAcreage(value) {
  const acreage = Number(value);
  if (!Number.isFinite(acreage) || acreage <= 0) throw new Error('Acreage must be a positive number');
  const maximum = await pricingConfigRepository.findByKey('MAX_LEAD_ACREAGE');
  if (!maximum || !Number.isFinite(maximum.value) || maximum.value <= 0) {
    throw new Error('The maximum acreage configuration is unavailable; contact operations');
  }
  if (acreage > maximum.value) throw new Error(`Acreage must not exceed ${maximum.value}`);
  return acreage;
}

function allowlistedLeadFields(input) {
  const hasChemical = optionalBoolean(input.hasChemical, 'hasChemical', true);
  const waterBodyNearby = optionalBoolean(input.waterBodyNearby, 'waterBodyNearby', false);
  const terrainType = optionalText(input.terrainType, 'terrainType');
  const chemicalProofUrl = optionalText(input.chemicalProofUrl, 'chemicalProofUrl', { maximum: 2048 });

  return {
    farmerAddress: optionalText(input.farmerAddress, 'farmerAddress', { maximum: 500 }),
    cropType: optionalText(input.cropType, 'cropType'),
    notes: optionalText(input.notes, 'notes', { maximum: 2000 }),
    preferredLanguage: i18nService.normalizeLanguage(input.preferredLanguage || 'ta'),
    soilType: optionalText(input.soilType, 'soilType'),
    cropAgeWeeks: optionalInteger(input.cropAgeWeeks, 'cropAgeWeeks'),
    chemicalBrand: optionalText(input.chemicalBrand, 'chemicalBrand'),
    sprayPurpose: optionalText(input.sprayPurpose, 'sprayPurpose', { maximum: 500 }),
    hasChemical,
    chemicalProofUrl,
    expectedDate: optionalDate(input.expectedDate),
    expectedTime: optionalText(input.expectedTime, 'expectedTime'),
    waterBodyNearby,
    terrainType,
  };
}

function statusForAcceptedIntake(intakeChannel) {
  return intakeChannel === 'MANUAL_SALES' ? 'PROCESSED' : 'NEW';
}

async function createIntake(input) {
  const {
    farmerName,
    farmerPhone,
    acreage,
    intakeChannel,
    latitude,
    longitude,
    actorId = null,
  } = input;
  const normalizedName = optionalText(farmerName, 'Farmer name');
  if (!normalizedName || normalizedName.length < 2) {
    throw new Error('Farmer name must contain between 2 and 120 characters');
  }
  const normalizedPhone = normalizePhone(farmerPhone);
  const normalizedAcreage = await validateAcreage(acreage);
  if (!ACCEPTED_CHANNELS.has(intakeChannel)) throw new Error('A valid intake channel is required');
  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
    throw new Error('A valid latitude and longitude are required for geofencing');
  }
  const fields = allowlistedLeadFields(input);
  const geofence = await geofenceService.evaluate(latitude, longitude);

  if (!geofence.matchedCenter) {
    const declinedEnquiry = await declinedEnquiryService.create({
      contactName: normalizedName,
      contactPhone: normalizedPhone,
      sourceChannel: intakeChannel,
      createdByUserId: actorId,
    });
    return { outcome: 'DECLINED', declinedEnquiryId: declinedEnquiry.id };
  }

  const status = statusForAcceptedIntake(intakeChannel);
  const lead = await leadRepository.create({
    farmerName: normalizedName,
    farmerPhone: normalizedPhone,
    acreage: normalizedAcreage,
    intakeChannel,
    latitude,
    longitude,
    status,
    matchedCenterId: geofence.matchedCenter.id,
    distanceFromCenterKm: geofence.distanceKm,
    processedAt: status === 'PROCESSED' ? new Date() : null,
    ...fields,
  });
  await auditLogService.record({
    entityType: 'Lead',
    entityId: lead.id,
    action: 'CREATED',
    actorId,
    afterState: { intakeChannel, status, matchedCenterId: lead.matchedCenterId },
  });
  await auditLogService.record({
    entityType: 'Lead',
    entityId: lead.id,
    action: 'GEOFENCE_VALIDATED',
    actorId,
    afterState: { status, matchedCenterId: lead.matchedCenterId },
  });
  return { outcome: 'ACCEPTED', lead, geofence };
}

async function triggerAutoAssignment(leadId) {
  try {
    return await autoAssignmentService.autoAssignProcessedLead(leadId);
  } catch (error) {
    logger.error('intake.auto-assignment-failed', { leadId, error: error.name });
    return null;
  }
}

module.exports = { createIntake, triggerAutoAssignment, validateAcreage };
