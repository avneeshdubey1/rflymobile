const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAPPING_VERSION = 'CLIENT_DRONE_INSPECTOR_V1';
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;
const EXPECTED_KEYS = Object.freeze([
  'battery_capacity', 'certified', 'date_added', 'drone_uas_id', 'drone_uin',
  'dsp_id', 'endurance', 'id', 'location_id', 'location_name', 'manufacturer',
  'model_name', 'name', 'service_type', 'tank_capacity', 'type', 'uas_date_created',
]);

function parseError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function bounded(value, field, maximum = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maximum) throw parseError('DRONE_FIELD_INVALID', `${field} is missing or too long`);
  return text;
}

function parseScalar(raw, field) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      throw parseError('DRONE_STRING_INVALID', `${field} contains an invalid quoted value`);
    }
  }
  throw parseError('DRONE_VALUE_INVALID', `${field} must be a quoted string or boolean`);
}

function parsePositiveInteger(value, field, maximum) {
  if (!/^\d+$/u.test(String(value))) throw parseError('DRONE_NUMBER_INVALID', `${field} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > maximum) {
    throw parseError('DRONE_NUMBER_INVALID', `${field} is outside the accepted range`);
  }
  return number;
}

function parseTankLitres(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d{1,2})?)\s*l$/iu);
  if (!match) throw parseError('DRONE_TANK_INVALID', 'tank_capacity must use a value such as 10L');
  const number = Number(match[1]);
  if (!(number > 0 && number <= 1000)) throw parseError('DRONE_TANK_INVALID', 'tank_capacity is outside the accepted range');
  return number;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isIsoInstant(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
    && !Number.isNaN(Date.parse(value));
}

function canonicalIdentity(row) {
  const name = bounded(row.name, 'name', 120).toUpperCase();
  const exportedUin = bounded(row.drone_uin, 'drone_uin', 120).toUpperCase();
  // The fleet contains both UA-prefixed and UB-prefixed DGCA identifiers.
  const nameIsUin = /^U[A-Z][A-Z0-9]+$/u.test(name);
  const exportedValueIsUin = /^U[A-Z][A-Z0-9]+$/u.test(exportedUin);
  const serialLooksValid = /^[A-Z0-9][A-Z0-9-]{5,119}$/u.test(exportedUin);
  if (nameIsUin && serialLooksValid && exportedUin !== name) return { uin: name, serialNumber: exportedUin };
  if (exportedValueIsUin) return { uin: exportedUin, serialNumber: null };
  throw parseError('DRONE_IDENTITY_INVALID', 'A row has no recognizable UIN and serial-number combination');
}

function normalizeRow(row, sourceIndex) {
  for (const key of EXPECTED_KEYS) {
    if (!Object.hasOwn(row, key)) throw parseError('DRONE_FIELD_MISSING', `Source row ${sourceIndex} is missing ${key}`);
  }
  const extras = Object.keys(row).filter((key) => !EXPECTED_KEYS.includes(key));
  if (extras.length) throw parseError('DRONE_FIELD_UNEXPECTED', `Source row ${sourceIndex} has unsupported fields`);
  for (const key of ['id', 'drone_uas_id', 'dsp_id', 'location_id']) {
    if (!isUuid(String(row[key]))) throw parseError('DRONE_UUID_INVALID', `Source row ${sourceIndex} has an invalid ${key}`);
  }
  for (const key of ['date_added', 'uas_date_created']) {
    if (!isIsoInstant(String(row[key]))) throw parseError('DRONE_DATE_INVALID', `Source row ${sourceIndex} has an invalid ${key}`);
  }
  if (typeof row.certified !== 'boolean') throw parseError('DRONE_CERTIFIED_INVALID', 'certified must be boolean');
  const identity = canonicalIdentity(row);
  const tankCapacityLitres = parseTankLitres(row.tank_capacity);
  const batteryCapacityMah = parsePositiveInteger(row.battery_capacity, 'battery_capacity', 10_000_000);
  const enduranceMinutes = parsePositiveInteger(row.endurance, 'endurance', 24 * 60);
  return {
    sourceIndex,
    sourceId: String(row.id).toLowerCase(),
    sourceAddedAt: String(row.date_added),
    identity,
    drone: {
      name: bounded(row.name, 'name', 120),
      type: bounded(row.type, 'type', 120),
      category: null,
      model: bounded(row.model_name, 'model_name', 120),
      manufacturer: bounded(row.manufacturer, 'manufacturer', 160),
      serialNumber: identity.serialNumber,
      uin: identity.uin,
      location: bounded(row.location_name, 'location_name', 240),
      tankCapacity: tankCapacityLitres,
      tankCapacityLitres,
      batteryCapacity: batteryCapacityMah,
      batteryCapacityMah,
      endurance: enduranceMinutes,
      enduranceMinutes,
      certified: row.certified,
      serviceType: bounded(row.service_type, 'service_type', 120),
      status: 'AVAILABLE',
      operationalState: 'IN_SERVICE',
      availabilityState: 'AVAILABLE',
    },
  };
}

function reconcileRows(rows) {
  const byUin = new Map();
  for (const row of rows) {
    const group = byUin.get(row.identity.uin) || [];
    group.push(row);
    byUin.set(row.identity.uin, group);
  }
  const assets = [];
  const superseded = [];
  for (const [uin, group] of byUin) {
    const complete = group.filter((row) => row.identity.serialNumber);
    if (complete.length !== 1) {
      throw parseError('DRONE_IDENTITY_REVIEW_REQUIRED', `UIN ${uin} does not resolve to exactly one complete asset record`);
    }
    const selected = complete[0];
    for (const row of group) {
      if (row === selected) continue;
      for (const field of ['model', 'manufacturer', 'type']) {
        if (row.drone[field] !== selected.drone[field]) {
          throw parseError('DRONE_DUPLICATE_CONFLICT', `Duplicate UIN ${uin} has conflicting ${field}`);
        }
      }
      superseded.push({ sourceIndex: row.sourceIndex, uin, selectedSourceIndex: selected.sourceIndex });
    }
    assets.push(selected);
  }
  const serials = new Set();
  for (const asset of assets) {
    if (serials.has(asset.drone.serialNumber)) throw parseError('DRONE_SERIAL_DUPLICATE', 'Multiple assets use the same serial number');
    serials.add(asset.drone.serialNumber);
  }
  return { assets: assets.sort((a, b) => a.sourceIndex - b.sourceIndex), superseded };
}

function parseInspectorText(text) {
  if (typeof text !== 'string' || !text.trim()) throw parseError('DRONE_FILE_EMPTY', 'The drone export is empty');
  if (text.includes('\0')) throw parseError('DRONE_FILE_INVALID', 'The drone export contains invalid bytes');
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  const rows = [];
  let current = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const header = line.match(/^(\d+):\s*\{/u);
    if (header) {
      const index = Number(header[1]);
      if (index !== rows.length) throw parseError('DRONE_INDEX_INVALID', 'Drone source indexes must be consecutive from zero');
      current = {};
      rows.push(current);
      if (rows.length > MAX_ROWS) throw parseError('DRONE_ROW_LIMIT', 'The drone export exceeds the row limit');
      continue;
    }
    if (!current) throw parseError('DRONE_FORMAT_INVALID', 'A property appears before the first indexed drone');
    const property = line.match(/^([a-z_]+):\s*(.+)$/u);
    if (!property) throw parseError('DRONE_FORMAT_INVALID', 'The drone export contains an unsupported line');
    if (Object.hasOwn(current, property[1])) throw parseError('DRONE_FIELD_DUPLICATE', 'A drone source row repeats a field');
    current[property[1]] = parseScalar(property[2], property[1]);
  }
  if (!rows.length) throw parseError('DRONE_ROWS_MISSING', 'The drone export contains no indexed rows');
  return reconcileRows(rows.map(normalizeRow));
}

async function preflight(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.json') throw parseError('DRONE_FILE_TYPE', 'The client export must use a .json filename');
  const stat = await fs.lstat(filePath).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw parseError('DRONE_FILE_INVALID', 'The drone export must be a readable regular file');
  if (stat.size <= 0 || stat.size > MAX_FILE_BYTES) throw parseError('DRONE_FILE_SIZE', 'The drone export size is outside the accepted limit');
  const bytes = await fs.readFile(filePath);
  const parsed = parseInspectorText(bytes.toString('utf8'));
  return {
    filePath: path.resolve(filePath),
    originalFileName: path.basename(filePath),
    fileSizeBytes: bytes.length,
    fileChecksum: crypto.createHash('sha256').update(bytes).digest('hex'),
    mappingVersion: MAPPING_VERSION,
    sourceRows: parsed.assets.length + parsed.superseded.length,
    canonicalAssets: parsed.assets.length,
    supersededRows: parsed.superseded.length,
    assets: parsed.assets,
    superseded: parsed.superseded,
  };
}

module.exports = { MAPPING_VERSION, parseInspectorText, preflight };
