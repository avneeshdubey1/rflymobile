const { Prisma } = require('@prisma/client');
const autoAssignmentPolicyRepository = require('../src/repositories/autoAssignmentPolicyRepository');

const editableFields = new Set([
  'enabled',
  'searchHorizonDays',
  'workingDayStartMinutes',
  'workingDayEndMinutes',
  'defaultJobDurationMinutes',
  'turnaroundMinutes',
  'maxJobsPerUnitPerDay',
  'maxAcreagePerUnitPerDay',
  'weatherUnavailableAction',
]);

const weatherActions = new Set(['SCHEDULE_WITH_WARNING', 'MANUAL_REVIEW']);

function policyError(message, code = 'POLICY_VALIDATION_FAILED') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireInteger(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw policyError(`${field} must be a whole number from ${minimum} to ${maximum}`);
  }
  return value;
}

function optionalPositiveInteger(value, field, maximum) {
  if (value === null) return null;
  return requireInteger(value, field, 1, maximum);
}

function optionalPositiveDecimal(value, field) {
  if (value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !Prisma.Decimal.isDecimal(value)) {
    throw policyError(`${field} must be a positive decimal or null`);
  }
  let decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw policyError(`${field} must be a positive decimal or null`);
  }
  if (!decimal.isFinite() || !decimal.greaterThan(0) || decimal.decimalPlaces() > 2 || decimal.greaterThan('9999999999.99')) {
    throw policyError(`${field} must be positive, have at most two decimal places, and fit the configured limit`);
  }
  return decimal;
}

function validateChanges(current, changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw policyError('Policy changes must be an object');
  }
  const keys = Object.keys(changes);
  if (!keys.length) throw policyError('At least one policy field is required');
  const unknown = keys.filter((key) => !editableFields.has(key));
  if (unknown.length) throw policyError(`Unsupported policy field: ${unknown[0]}`);

  const merged = { ...current, ...changes };
  const normalized = {};
  if ('enabled' in changes) {
    if (typeof changes.enabled !== 'boolean') throw policyError('enabled must be true or false');
    normalized.enabled = changes.enabled;
  }
  if ('searchHorizonDays' in changes) normalized.searchHorizonDays = requireInteger(changes.searchHorizonDays, 'searchHorizonDays', 1, 14);
  if ('workingDayStartMinutes' in changes) normalized.workingDayStartMinutes = requireInteger(changes.workingDayStartMinutes, 'workingDayStartMinutes', 0, 1439);
  if ('workingDayEndMinutes' in changes) normalized.workingDayEndMinutes = requireInteger(changes.workingDayEndMinutes, 'workingDayEndMinutes', 1, 1440);
  if ('defaultJobDurationMinutes' in changes) normalized.defaultJobDurationMinutes = requireInteger(changes.defaultJobDurationMinutes, 'defaultJobDurationMinutes', 15, 720);
  if ('turnaroundMinutes' in changes) normalized.turnaroundMinutes = requireInteger(changes.turnaroundMinutes, 'turnaroundMinutes', 0, 240);
  if ('maxJobsPerUnitPerDay' in changes) normalized.maxJobsPerUnitPerDay = optionalPositiveInteger(changes.maxJobsPerUnitPerDay, 'maxJobsPerUnitPerDay', 20);
  if ('maxAcreagePerUnitPerDay' in changes) normalized.maxAcreagePerUnitPerDay = optionalPositiveDecimal(changes.maxAcreagePerUnitPerDay, 'maxAcreagePerUnitPerDay');
  if ('weatherUnavailableAction' in changes) {
    if (!weatherActions.has(changes.weatherUnavailableAction)) throw policyError('weatherUnavailableAction is invalid');
    normalized.weatherUnavailableAction = changes.weatherUnavailableAction;
  }

  const start = normalized.workingDayStartMinutes ?? merged.workingDayStartMinutes;
  const end = normalized.workingDayEndMinutes ?? merged.workingDayEndMinutes;
  if (end <= start) throw policyError('workingDayEndMinutes must be after workingDayStartMinutes');
  return normalized;
}

async function getPolicy() {
  const policy = await autoAssignmentPolicyRepository.findCompanyPolicy();
  if (!policy) throw policyError('Auto-assignment policy is unavailable', 'POLICY_UNAVAILABLE');
  return policy;
}

async function updatePolicy({ actorId, expectedRevision, changes }) {
  if (!actorId) throw policyError('An authenticated Admin actor is required', 'POLICY_ACTOR_REQUIRED');
  requireInteger(expectedRevision, 'expectedRevision', 1, Number.MAX_SAFE_INTEGER);
  const current = await getPolicy();
  if (current.revision !== expectedRevision) {
    const error = policyError('Auto-assignment policy was changed by another administrator', 'POLICY_REVISION_CONFLICT');
    error.currentRevision = current.revision;
    throw error;
  }
  const data = validateChanges(current, changes);
  return autoAssignmentPolicyRepository.updateCompanyPolicy({ expectedRevision, data, actorId });
}

module.exports = {
  getPolicy,
  updatePolicy,
  validateChanges,
};
