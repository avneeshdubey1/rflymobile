const leadRepository = require('../src/repositories/leadRepository');
const auditLogService = require('./auditLogService');
const geofenceService = require('./geofenceService');
const declinedEnquiryService = require('./declinedEnquiryService');
const i18nService = require('./i18nService');
const { normalizePhone } = require('./identityService');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');
const autoAssignmentService = require('./autoAssignmentService');
const logger = require('./loggerService');
const masterDataRepository = require('../src/repositories/masterDataRepository');

const ACCEPTED_CHANNELS = new Set(['WEBSITE', 'MANUAL_SALES']);
const MAX_TEXT_LENGTH = 120;
const DEFAULT_ACREAGE_SAFETY_LIMIT = 10_000;

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

function optionalSprayPurpose(value) {
  if (!Array.isArray(value)) return optionalText(value, 'sprayPurpose', { maximum: 500 });
  if (value.length > 20 || value.some((item) => typeof item !== 'string')) {
    throw new Error('sprayPurpose must contain at most 20 text values');
  }
  const joined = value.map((item) => item.trim()).filter(Boolean).join(', ');
  return optionalText(joined, 'sprayPurpose', { maximum: 500 });
}

async function validateAcreage(value) {
  const acreage = Number(value);
  if (!Number.isFinite(acreage) || acreage <= 0) throw new Error('Acreage must be a positive number');
  const safetyLimit = Number(process.env.LEAD_ACREAGE_SAFETY_LIMIT || DEFAULT_ACREAGE_SAFETY_LIMIT);
  if (!Number.isFinite(safetyLimit) || safetyLimit <= 0) {
    throw new Error('The acreage safety limit is unavailable; contact operations');
  }
  const configuredMaximum = await pricingConfigRepository.findByKey('MAX_LEAD_ACREAGE');
  const businessLimit = Number(configuredMaximum?.value);
  const maximum = Number.isFinite(businessLimit) && businessLimit > 0
    ? Math.min(businessLimit, safetyLimit)
    : safetyLimit;
  if (acreage > maximum) throw new Error(`Acreage must not exceed ${maximum}`);
  return acreage;
}

async function controlledMetadata(input) {
  const requestType = String(input.requestType || '').toUpperCase();
  if (!['B2B', 'B2C'].includes(requestType)) throw new Error('Request type must be B2B or B2C');
  const b2bSubcategoryCode = optionalText(input.b2bSubcategoryCode, 'B2B sub-category', { maximum: 60 });
  if (requestType === 'B2B' && !b2bSubcategoryCode) throw new Error('B2B sub-category is required for B2B requests');
  if (requestType === 'B2C' && b2bSubcategoryCode) throw new Error('B2B sub-category is not allowed for B2C requests');
  const clusterId = optionalText(input.clusterId, 'Cluster', { maximum: 80 });
  if (!clusterId || !(await masterDataRepository.findClusterById(clusterId))?.active) throw new Error('Select an active cluster');
  const reportingAdminCode = optionalText(input.reportingAdminCode, 'Reporting Admin', { maximum: 60 });
  if (!(await masterDataRepository.findValue('REPORTING_ADMIN', reportingAdminCode))?.active) throw new Error('Select an active Reporting Admin');
  const leadSourceCode = optionalText(input.leadSourceCode, 'Lead source', { maximum: 60 });
  const leadSource = leadSourceCode ? await masterDataRepository.findValue('LEAD_SOURCE', leadSourceCode) : null;
  if (!leadSource?.active) throw new Error('Select an active Lead Source');
  if (requestType === 'B2B') {
    const category = await masterDataRepository.findValue('B2B_SUBCATEGORY', b2bSubcategoryCode);
    if (!category?.active) throw new Error('Select an active B2B sub-category');
  }
  const purposes = Array.isArray(input.sprayPurpose) ? input.sprayPurpose : String(input.sprayPurpose || '').split(/[,;]/);
  const purposeCodes = purposes.map((item) => String(item).trim()).filter(Boolean);
  if (!purposeCodes.length) throw new Error('Select at least one Spray Purpose');
  for (const purposeCode of purposeCodes) {
    if (!(await masterDataRepository.findValue('SPRAY_PURPOSE', purposeCode))?.active) throw new Error('Select only active Spray Purpose values');
  }
  return { requestType, b2bSubcategoryCode: requestType === 'B2B' ? b2bSubcategoryCode : null, clusterId, reportingAdminCode, leadSourceCode, purposeCodes };
}

function includesControlledMetadata(input) {
  return [
    'requestType',
    'b2bSubcategoryCode',
    'clusterId',
    'reportingAdminCode',
    'leadSourceCode',
  ].some((field) => input[field] !== undefined && input[field] !== null && input[field] !== '');
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
    // Historical imports deliberately retain `und` when the source did not
    // record a language. Operational notifications still need a supported
    // dictionary, so use the established Tamil default for that one sentinel.
    // Other unsupported values continue to fail validation.
    preferredLanguage: i18nService.normalizeOperationalLanguage(input.preferredLanguage),
    soilType: optionalText(input.soilType, 'soilType'),
    cropAgeWeeks: optionalInteger(input.cropAgeWeeks, 'cropAgeWeeks'),
    chemicalBrand: optionalText(input.chemicalBrand, 'chemicalBrand'),
    sprayPurpose: optionalSprayPurpose(input.sprayPurpose),
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
    customerId = null,
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
  // Older staff-assisted clients predate the controlled master-data fields.
  // Preserve that compatibility path only when none of the new fields is sent;
  // once a caller opts into the new contract, validate the complete selection.
  const metadata = input.intakeChannel === 'MANUAL_SALES' && includesControlledMetadata(input)
    ? await controlledMetadata(input)
    : null;
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
    customerId,
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
    ...(metadata ? {
      requestType: metadata.requestType,
      b2bSubcategoryCode: metadata.b2bSubcategoryCode,
      clusterId: metadata.clusterId,
      reportingAdminCode: metadata.reportingAdminCode,
      leadSourceCode: metadata.leadSourceCode,
    } : {}),
  }, { actorId, sprayPurposes: metadata?.purposeCodes ?? input.sprayPurpose ?? fields.sprayPurpose });
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

async function triggerAutoAssignment(leadId, actorId = null) {
  try {
    return await autoAssignmentService.autoAssignProcessedLead(leadId, { actorId });
  } catch (error) {
    logger.error('intake.auto-assignment-failed', { leadId, error: error.name });
    return null;
  }
}

module.exports = { createIntake, triggerAutoAssignment, validateAcreage };
