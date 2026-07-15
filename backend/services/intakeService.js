const leadRepository = require('../src/repositories/leadRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const geofenceService = require('./geofenceService');
const whatsappService = require('./whatsappService');
const i18nService = require('./i18nService');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');

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

  const geofence = await geofenceService.evaluate(latitude, longitude);
  let status = 'OUT_OF_RANGE';
  if (intakeChannel === 'MANUAL_SALES') {
    status = 'PROCESSED';
  } else if (geofence.matchedCenter) {
    status = intakeChannel === 'GOOGLE_FORM' ? 'PROCESSED' : 'NEW';
  }
  
  delete optional.status;
  delete optional.processedAt;

  const lead = await leadRepository.create({
    farmerName: normalizedName, farmerPhone: normalizedPhone, acreage: normalizedAcreage, intakeChannel, latitude, longitude,
    status, matchedCenterId: geofence.matchedCenter?.id || null, distanceFromCenterKm: geofence.distanceKm,
    processedAt: status === 'PROCESSED' ? new Date() : null, preferredLanguage: i18nService.normalizeLanguage(preferredLanguage), ...optional,
  });
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'CREATED', afterState: lead });
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'GEOFENCE_CHECKED', afterState: { status, matchedCenterId: lead.matchedCenterId, distanceFromCenterKm: lead.distanceFromCenterKm } });
  if (status === 'PROCESSED') await whatsappService.sendForStatus(lead, 'PROCESSED');

  const appealOffer = status === 'OUT_OF_RANGE' ? await geofenceService.suggestedAppealFee(geofence.distanceKm, geofence.nearestCenter) : null;
  return { lead, geofence, appealOffer };
}

module.exports = { createLead };
