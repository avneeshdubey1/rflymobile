const crypto = require('node:crypto');
const { readSafeWorkbook, WorkbookPreflightError } = require('./xlsxPreflight');

const MAPPING_VERSION = 'RFLY_CLIENT_MASTER_WORKBOOK_V1';
const EXPECTED_SHEETS = Object.freeze([
  'spray purpose', 'crop type', 'PRICE', 'type of operations', 'B2B LIST', 'B2C LIST ',
  'cluster locations', 'pilots master ', 'ADMIN', 'LEAD SOURCE', 'DRONE NUMBER ',
]);

function error(code, message) {
  const result = new Error(message);
  result.code = code;
  return result;
}

function text(value, maximum = 160) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw error('MASTER_IMPORT_FIELD_TOO_LONG', 'A client master value is too long');
  return normalized;
}

function code(value, prefix = '') {
  const raw = text(value, 160);
  if (!raw) throw error('MASTER_IMPORT_CODE_INVALID', 'A required client master value is missing');
  const normalized = `${prefix}${raw}`.toUpperCase().replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');
  if (!normalized || normalized.length > 60) throw error('MASTER_IMPORT_CODE_INVALID', 'A client master code is invalid');
  return normalized;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function sheetByName(workbook, name) {
  const sheet = workbook.sheets.find((item) => item.sheet === name);
  if (!sheet) throw error('MASTER_IMPORT_SHEET_MISSING', 'A required client master sheet is missing');
  return sheet.data || [];
}

function listValues(rows, prefix = '') {
  const seen = new Set();
  const values = [];
  for (const row of rows.slice(1)) {
    const displayName = text(row[0]);
    if (!displayName) continue;
    const itemCode = code(displayName, prefix);
    if (seen.has(itemCode)) continue;
    seen.add(itemCode);
    values.push({ code: itemCode, displayName });
  }
  return values;
}

function pilotRows(rows) {
  const seen = new Set();
  const pilots = [];
  for (const [offset, row] of rows.slice(1).entries()) {
    const name = text(row[0], 120);
    if (!name) continue;
    const suppliedEmployeeCode = text(row[1], 60);
    const employeeCode = suppliedEmployeeCode
      ? code(suppliedEmployeeCode)
      : `IMPORT_PILOT_${digest(name.toLocaleLowerCase('en-US')).slice(0, 12).toUpperCase()}`;
    if (seen.has(employeeCode)) throw error('MASTER_IMPORT_DUPLICATE_PILOT', 'The workbook contains duplicate Pilot identities');
    seen.add(employeeCode);
    pilots.push({
      sourceIndex: offset + 2,
      name,
      employeeCode,
      generatedEmployeeCode: !suppliedEmployeeCode,
      droneSerialNumber: text(row[3], 120)?.toUpperCase() || null,
      lmvRegistrationNo: text(row[4], 40)?.toUpperCase() || null,
      gensetReference: text(row[5], 120),
    });
  }
  return pilots;
}

function reportingAdminRows(rows) {
  const seen = new Set();
  const reportingAdmins = [];
  for (const row of rows.slice(1)) {
    const displayName = text(row[0], 120);
    if (!displayName) continue;
    const suppliedCode = text(row[1], 60);
    const itemCode = suppliedCode ? code(suppliedCode) : code(displayName, 'REPORTING_ADMIN_');
    if (seen.has(itemCode)) throw error('MASTER_IMPORT_DUPLICATE_REPORTING_ADMIN', 'The workbook contains duplicate reporting-admin identities');
    seen.add(itemCode);
    reportingAdmins.push({ code: itemCode, displayName });
  }
  return reportingAdmins;
}

function uniqueAssets(values, field, label) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value[field])) return false;
    seen.add(value[field]);
    return true;
  }).map((value) => ({ ...value, label }));
}

async function preflight(filePath) {
  let workbook;
  try {
    workbook = await readSafeWorkbook(filePath, { expectedSheetNames: EXPECTED_SHEETS });
  } catch (failure) {
    if (failure instanceof WorkbookPreflightError) throw failure;
    throw error('MASTER_IMPORT_WORKBOOK_INVALID', 'The client master workbook could not be safely read');
  }

  const purposes = listValues(sheetByName(workbook, 'spray purpose'));
  const crops = listValues(sheetByName(workbook, 'crop type'));
  const b2bSubcategories = listValues(sheetByName(workbook, 'B2B LIST'));
  const b2cClassifications = listValues(sheetByName(workbook, 'B2C LIST '));
  const clusters = listValues(sheetByName(workbook, 'cluster locations'), 'CLUSTER_')
    .map((item) => ({ ...item, type: 'CLUSTER' }));
  const reportingAdmins = reportingAdminRows(sheetByName(workbook, 'ADMIN'));
  const leadSources = listValues(sheetByName(workbook, 'LEAD SOURCE'));
  const requestTypes = listValues(sheetByName(workbook, 'type of operations'));
  const pilots = pilotRows(sheetByName(workbook, 'pilots master '));
  const drones = uniqueAssets([
    ...listValues(sheetByName(workbook, 'DRONE NUMBER ')).map((item) => ({ serialNumber: item.displayName.toUpperCase() })),
    ...pilots.filter((pilot) => pilot.droneSerialNumber).map((pilot) => ({ serialNumber: pilot.droneSerialNumber })),
  ], 'serialNumber', 'CLIENT_MASTER_UNSPECIFIED');
  const lmvs = uniqueAssets(pilots.filter((pilot) => pilot.lmvRegistrationNo).map((pilot) => ({
    registrationNo: pilot.lmvRegistrationNo,
    gensetReference: pilot.gensetReference,
  })), 'registrationNo', null);

  const mappedDroneOwners = new Map();
  const mappedLmvOwners = new Map();
  for (const pilot of pilots) {
    for (const [kind, identifier, owners] of [
      ['drone', pilot.droneSerialNumber, mappedDroneOwners],
      ['LMV', pilot.lmvRegistrationNo, mappedLmvOwners],
    ]) {
      if (!identifier) continue;
      const owner = owners.get(identifier);
      if (owner && owner !== pilot.employeeCode) throw error('MASTER_IMPORT_ASSET_MAPPING_CONFLICT', `The workbook maps one ${kind} to multiple Pilots`);
      owners.set(identifier, pilot.employeeCode);
    }
  }

  const invalidRequestTypes = requestTypes.filter((item) => !['B2B', 'B2C'].includes(item.code));
  if (invalidRequestTypes.length) throw error('MASTER_IMPORT_REQUEST_TYPE_INVALID', 'The workbook contains an unsupported request type');

  const canonical = {
    mappingVersion: MAPPING_VERSION,
    purposes,
    crops,
    b2bSubcategories,
    b2cClassifications,
    clusters,
    reportingAdmins,
    leadSources,
    requestTypes: requestTypes.map((item) => item.code),
    pilots,
    drones,
    lmvs,
  };
  return {
    ...workbook,
    mappingVersion: MAPPING_VERSION,
    canonical,
    safeSummary: {
      accepted: true,
      mappingVersion: MAPPING_VERSION,
      fileChecksum: workbook.fileChecksum,
      fileSizeBytes: workbook.fileSizeBytes,
      counts: {
        sprayPurposes: purposes.length,
        crops: crops.length,
        b2bSubcategories: b2bSubcategories.length,
        b2cClassifications: b2cClassifications.length,
        clusters: clusters.length,
        reportingAdmins: reportingAdmins.length,
        leadSources: leadSources.length,
        pilots: pilots.length,
        drones: drones.length,
        lmvs: lmvs.length,
      },
      excluded: ['PRICE'],
    },
  };
}

module.exports = { MAPPING_VERSION, preflight, stable, digest };
