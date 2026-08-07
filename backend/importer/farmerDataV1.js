const MAPPING_VERSION = 'FARMER_WORKBOOK_V1';

const SHEETS = Object.freeze({
  CRM: Object.freeze({
    name: 'CRM download',
    sourceSystem: 'ZOHO_CRM',
    headers: Object.freeze([
      'S.NO',
      'Last Name',
      'Lead Name',
      'Phone',
      'Address - City',
      'ACERES',
      'Date',
      'CROP TYPE -1',
      'ZONES',
    ]),
  }),
  GOOGLE: Object.freeze({
    name: 'GOOGLE FORMS DATA',
    sourceSystem: 'GOOGLE_FORMS',
    headers: Object.freeze([
      'S.No',
      'Timestamp',
      'Name Of the Pilot',
      "Employ I'd",
      'Visiting Village Name',
      'Name of the Mandal',
      'Name of the District',
      'Farmer Name',
      'Contact Number',
      'Crop Name',
      'No.of Acers',
      'Frequently used fertilizer Shop Name.',
      'Expected Spraying Times/Acers.',
      'GPS Capture Photo with Farmer',
      'GPS Capture Photo with Leaflet',
      'FARMER TYPE',
    ]),
  }),
});

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/gu, ' ').trim();
  return text || null;
}

function boundedText(value, maximum) {
  const text = normalizeText(value);
  if (!text) return { value: null };
  if (text.length > maximum) return { value: null, reason: 'FIELD_TOO_LONG' };
  return { value: text };
}

// The source sheets call this value S.NO/S.No. It is a workbook-provided row
// identifier, not a Zoho CRM GUID and not an RFLY primary key. Preserve a
// nonblank value only when it fits the SourceRecord.externalRecordId boundary;
// never truncate it into a different identity.
function normalizeWorkbookRowId(value) {
  const bounded = boundedText(value, 160);
  return bounded.reason
    ? { value: null, reason: 'SOURCE_WORKBOOK_ROW_ID_TOO_LONG' }
    : bounded;
}

function normalizePhone(value) {
  const text = normalizeText(value);
  if (!text) return { value: null, reason: 'MISSING_PHONE' };
  if (/[^\d\s+()-]/u.test(text)) return { value: null, reason: 'INVALID_PHONE' };
  const digits = text.replace(/\D/gu, '');
  if (/^[6-9]\d{9}$/u.test(digits)) return { value: `+91${digits}` };
  if (/^91[6-9]\d{9}$/u.test(digits)) return { value: `+${digits}` };
  if (/^0[6-9]\d{9}$/u.test(digits)) return { value: `+91${digits.slice(1)}` };
  return { value: null, reason: 'INVALID_PHONE' };
}

function normalizeLookup(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDecimal(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { value: null, reason: 'MISSING_ACREAGE' };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0 || value > 9_999_999_999.99) {
      return { value: null, reason: 'INVALID_ACREAGE' };
    }
    if (Math.abs((value * 100) - Math.round(value * 100)) > 1e-7) {
      return { value: null, reason: 'ACREAGE_PRECISION_REVIEW_REQUIRED' };
    }
    return { value: value.toFixed(2) };
  }
  const text = String(value).trim();
  if (/^\d+(?:\.\d{1,2})?$/u.test(text)) {
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 9_999_999_999.99) return { value: parsed.toFixed(2) };
    return { value: null, reason: 'INVALID_ACREAGE' };
  }
  if (/^\d+(?:\.\d+)?\s*(?:acre|acres|acer|acers)\.?$/iu.test(text)) {
    return { value: null, reason: 'ACREAGE_UNIT_REVIEW_REQUIRED' };
  }
  return { value: null, reason: 'INVALID_ACREAGE' };
}

function validDateParts(year, month, day, hour = 0, minute = 0, second = 0) {
  if (![year, month, day, hour, minute, second].every(Number.isInteger)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function dateOnlyFromParts(year, month, day) {
  if (!validDateParts(year, month, day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: dateOnlyFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) };
  }
  const text = normalizeText(value);
  if (!text) return { value: null, reason: 'MISSING_SERVICE_DATE' };
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/u);
  if (match) {
    const parsed = dateOnlyFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
    return parsed ? { value: parsed } : { value: null, reason: 'INVALID_SERVICE_DATE' };
  }
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/u);
  if (match) {
    const parsed = dateOnlyFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
    return parsed ? { value: parsed } : { value: null, reason: 'INVALID_SERVICE_DATE' };
  }
  return { value: null, reason: 'INVALID_SERVICE_DATE' };
}

function parseVisitTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const localAsUtc = Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    ) - (330 * 60 * 1000);
    return { value: new Date(localAsUtc) };
  }
  const text = normalizeText(value);
  if (!text) return { value: null, reason: 'MISSING_VISIT_TIMESTAMP' };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
      ? { value: null, reason: 'INVALID_VISIT_TIMESTAMP' }
      : { value: parsed };
  }
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/iu);
  if (!match) return { value: null, reason: 'INVALID_VISIT_TIMESTAMP' };
  let hour = Number(match[4] || 0);
  const marker = String(match[7] || '').toLowerCase();
  if (marker && (hour < 1 || hour > 12)) return { value: null, reason: 'INVALID_VISIT_TIMESTAMP' };
  if (marker === 'pm' && hour < 12) hour += 12;
  if (marker === 'am' && hour === 12) hour = 0;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first >= 1 && first <= 12 && second >= 1 && second <= 12) {
    return { value: null, reason: 'AMBIGUOUS_VISIT_TIMESTAMP' };
  }
  let month;
  let day;
  if (first >= 1 && first <= 12 && second > 12) {
    month = first;
    day = second;
  } else if (first > 12 && second >= 1 && second <= 12) {
    day = first;
    month = second;
  } else {
    return { value: null, reason: 'INVALID_VISIT_TIMESTAMP' };
  }
  const parts = [Number(match[3]), month, day, hour, Number(match[5] || 0), Number(match[6] || 0)];
  if (!validDateParts(...parts)) return { value: null, reason: 'INVALID_VISIT_TIMESTAMP' };
  const instant = Date.UTC(...[parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]]) - (330 * 60 * 1000);
  return { value: new Date(instant) };
}

function serializableCell(value) {
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (typeof value === 'number') return { type: 'number', value: String(value) };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  return { type: 'text', value: String(value ?? '') };
}

function isBlankRow(row) {
  return row.every((value) => normalizeText(value) === null);
}

function mapCrmRow(row, rowNumber) {
  const workbookRowId = normalizeWorkbookRowId(row[0]);
  return {
    sourceSystem: SHEETS.CRM.sourceSystem,
    sheetName: SHEETS.CRM.name,
    sourceRowNumber: rowNumber,
    externalRecordId: workbookRowId.value,
    externalRecordIdReason: workbookRowId.reason || null,
    payload: {
      sourceSerial: row[0] ?? null,
      lastName: row[1] ?? null,
      leadName: row[2] ?? null,
      phone: row[3] ?? null,
      city: row[4] ?? null,
      acres: row[5] ?? null,
      serviceDate: row[6] ?? null,
      crop: row[7] ?? null,
      zone: row[8] ?? null,
    },
    rawCells: row.map(serializableCell),
    empty: isBlankRow(row),
  };
}

function mapGoogleRow(row, rowNumber) {
  const workbookRowId = normalizeWorkbookRowId(row[0]);
  return {
    sourceSystem: SHEETS.GOOGLE.sourceSystem,
    sheetName: SHEETS.GOOGLE.name,
    sourceRowNumber: rowNumber,
    externalRecordId: workbookRowId.value,
    externalRecordIdReason: workbookRowId.reason || null,
    payload: {
      sourceSerial: row[0] ?? null,
      timestamp: row[1] ?? null,
      collectorName: row[2] ?? null,
      employeeCode: row[3] ?? null,
      village: row[4] ?? null,
      mandal: row[5] ?? null,
      district: row[6] ?? null,
      farmerName: row[7] ?? null,
      phone: row[8] ?? null,
      crop: row[9] ?? null,
      acres: row[10] ?? null,
      fertilizerShop: row[11] ?? null,
      expectedSpraying: row[12] ?? null,
      farmerPhotoReference: row[13] ?? null,
      leafletPhotoReference: row[14] ?? null,
      farmerType: row[15] ?? null,
    },
    rawCells: row.map(serializableCell),
    empty: isBlankRow(row),
  };
}

function mapWorkbookRows(sheets) {
  const crm = sheets.find((sheet) => sheet.name === SHEETS.CRM.name);
  const google = sheets.find((sheet) => sheet.name === SHEETS.GOOGLE.name);
  return [
    ...crm.rows.slice(1).map((row, index) => mapCrmRow(row, index + 2)),
    ...google.rows.slice(1).map((row, index) => mapGoogleRow(row, index + 2)),
  ];
}

module.exports = {
  MAPPING_VERSION,
  SHEETS,
  boundedText,
  mapWorkbookRows,
  normalizeDecimal,
  normalizeHeader,
  normalizeLookup,
  normalizePhone,
  normalizeText,
  normalizeWorkbookRowId,
  parseDateOnly,
  parseVisitTimestamp,
};
