const crypto = require('node:crypto');
const path = require('node:path');
const importRepository = require('../src/repositories/importRepository');
const { preflightWorkbook } = require('../importer/xlsxPreflight');
const {
  MAPPING_VERSION,
  boundedText,
  mapWorkbookRows,
  normalizeDecimal,
  normalizeLookup,
  normalizePhone,
  normalizeText,
  parseDateOnly,
  parseVisitTimestamp,
} = require('../importer/farmerDataV1');
const {
  decryptPayload,
  derivePurposeKey,
  encryptPayload,
  phoneFingerprint,
} = require('../importer/stagingCrypto');

const DEFAULT_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 30;

function importError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function keyedDigest(label, value, key) {
  return crypto.createHmac('sha256', derivePurposeKey(key, label)).update(stableJson(value), 'utf8').digest('hex');
}

function sourceRowFingerprint(row, key) {
  return keyedDigest('source-row-v1', { sourceSystem: row.sourceSystem, rawCells: row.rawCells }, key);
}

function encodeDates(value) {
  if (value instanceof Date) return { __farmerImportDate: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeDates(item)]));
  }
  return value;
}

function decodeDates(value) {
  if (Array.isArray(value)) return value.map(decodeDates);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.__farmerImportDate === 'string') {
      const date = new Date(value.__farmerImportDate);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeDates(item)]));
  }
  return value;
}

function safeBatch(batch) {
  if (!batch) return null;
  return {
    id: safeIdentifier(batch.id),
    attemptNumber: Number.isInteger(batch.attemptNumber) && batch.attemptNumber > 0
      ? batch.attemptNumber
      : null,
    supersedesBatchId: safeIdentifier(batch.supersedesBatchId),
    sourceType: batch.sourceType === 'FARMER_WORKBOOK' ? batch.sourceType : null,
    workbookType: batch.workbookType === 'XLSX' ? batch.workbookType : null,
    mappingVersion: batch.mappingVersion === MAPPING_VERSION ? batch.mappingVersion : null,
    status: [
      'STAGED',
      'VALIDATED',
      'REVIEW_REQUIRED',
      'APPROVED',
      'IMPORTING',
      'COMPLETED',
      'FAILED',
      'ROLLED_BACK',
      'SUPERSEDED',
    ].includes(batch.status) ? batch.status : null,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    rejectedRows: batch.rejectedRows,
    reviewRows: batch.reviewRows,
    importedRows: batch.importedRows,
    skippedRows: batch.skippedRows,
    rawRetentionUntil: batch.rawRetentionUntil,
    approvedAt: batch.approvedAt,
    completedAt: batch.completedAt,
    reconciledAt: batch.reconciledAt,
    failureCode: safeCode(batch.failureCode),
    safeReport: projectSafeReport(batch.safeReport),
  };
}

function numericObject(value, allowedKeys) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(allowedKeys
    .filter((key) => Number.isInteger(value[key]) && value[key] >= 0)
    .map((key) => [key, value[key]]));
}

function safeIdentifier(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
    ? value
    : null;
}

function safeCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_:-]{0,79}$/u.test(value) ? value : null;
}

function projectSafeReport(report) {
  if (!report || typeof report !== 'object') return null;
  const sheets = {};
  for (const [name, value] of Object.entries(report.sheets || {})) {
    if (!['CRM download', 'GOOGLE FORMS DATA'].includes(name) || !value || typeof value !== 'object') continue;
    sheets[name] = {
      sourceSystem: ['ZOHO_CRM', 'GOOGLE_FORMS'].includes(value.sourceSystem) ? value.sourceSystem : null,
      ...numericObject(value, ['totalRows', 'validRows', 'rejectedRows', 'reviewRows', 'skippedRows']),
    };
  }
  const hash = (value) => (typeof value === 'string' && /^[a-f0-9]{64}$/iu.test(value) ? value : null);
  return {
    batchId: safeIdentifier(report.batchId),
    mappingVersion: report.mappingVersion === MAPPING_VERSION ? report.mappingVersion : null,
    status: ['VALIDATED', 'REVIEW_REQUIRED', 'COMPLETED'].includes(report.status) ? report.status : null,
    counts: numericObject(report.counts, ['totalRows', 'validRows', 'rejectedRows', 'reviewRows', 'skippedRows']),
    sheets,
    customerResolution: numericObject(report.customerResolution, [
      'newCustomerCandidates',
      'matchedCustomers',
      'possibleDuplicateRows',
      'conflictingIdentityRows',
      'existingCustomerIdentityReviewRows',
      'inactiveCustomerReviewRows',
    ]),
    plannedOutcomes: numericObject(report.plannedOutcomes, ['historicalServices', 'villageVisits']),
    validationSummary: numericObject(report.validationSummary, ['unknownCropRows', 'invalidLocationRows']),
    finalOutcomes: numericObject(report.finalOutcomes, ['importedRows', 'skippedRows']),
    referenceDataFingerprint: hash(report.referenceDataFingerprint),
    dryRunPlanHash: hash(report.dryRunPlanHash),
  };
}

function safeRecord(record) {
  const details = record.safeDetails && typeof record.safeDetails === 'object' ? record.safeDetails : {};
  const references = details.references && typeof details.references === 'object' ? details.references : {};
  return {
    id: safeIdentifier(record.id),
    sourceSystem: ['ZOHO_CRM', 'GOOGLE_FORMS'].includes(record.sourceSystem) ? record.sourceSystem : null,
    sheetName: ['CRM download', 'GOOGLE FORMS DATA'].includes(record.sheetName) ? record.sheetName : null,
    sourceRowNumber: record.sourceRowNumber,
    status: ['PENDING', 'VALID', 'REJECTED', 'REVIEW_REQUIRED', 'IMPORTED', 'SKIPPED', 'ROLLED_BACK'].includes(record.status)
      ? (record.status === 'VALID'
        && typeof record.proposedOutcome === 'string'
        && record.proposedOutcome.startsWith('SKIP_')
        ? 'SKIPPED'
        : record.status)
      : null,
    reasonCode: safeCode(record.reasonCode),
    safeDetails: {
      reasonCodes: Array.isArray(details.reasonCodes)
        ? details.reasonCodes.filter((value) => typeof value === 'string' && /^[A-Z][A-Z0-9_:-]{0,79}$/u.test(value))
        : [],
      existingCustomerId: safeIdentifier(details.existingCustomerId),
      references: {
        cropId: safeIdentifier(references.cropId),
        operatingCenterId: safeIdentifier(references.operatingCenterId),
        administrativeLocationId: safeIdentifier(references.administrativeLocationId),
        collectorUserId: safeIdentifier(references.collectorUserId),
      },
    },
    proposedOutcome: safeCode(record.proposedOutcome),
    finalOutcome: safeCode(record.finalOutcome),
    customerId: safeIdentifier(record.customerId),
    resultEntityType: ['HistoricalServiceRecord', 'VillageVisit'].includes(record.resultEntityType)
      ? record.resultEntityType
      : null,
    resultEntityId: safeIdentifier(record.resultEntityId),
    committedAt: record.committedAt,
  };
}

function fingerprintReferences(referenceData) {
  return sha256({
    languages: (referenceData.languages || []).map((item) => ({
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      active: item.active,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    crops: referenceData.crops.map((item) => ({
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      normalizedName: item.normalizedName,
      active: item.active,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    operatingCenters: referenceData.operatingCenters.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      active: item.active,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    locations: referenceData.locations.map((item) => ({
      id: item.id,
      countryCode: item.countryCode,
      state: item.state,
      district: item.district,
      mandal: item.mandal,
      village: item.village,
      normalizedKey: item.normalizedKey,
      active: item.active,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    employees: (referenceData.employees || []).map((item) => ({
      id: item.id,
      employeeCode: item.employeeCode,
      active: item.active,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function uniqueMatch(items, predicate) {
  const matches = items.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

function normalizeCropLookup(value) {
  return normalizeLookup(value)?.replace(/[^\p{L}\p{N}]+/gu, '') || null;
}

function findCrop(rawValue, references) {
  const lookup = normalizeCropLookup(rawValue);
  if (!lookup) return null;
  return uniqueMatch(references.crops, (crop) => [crop.code, crop.displayName, crop.normalizedName]
    .some((value) => normalizeCropLookup(value) === lookup));
}

function findCenter(rawValue, references) {
  const lookup = normalizeLookup(rawValue);
  if (!lookup) return null;
  return uniqueMatch(references.operatingCenters, (center) => [center.code, center.name]
    .some((value) => normalizeLookup(value) === lookup));
}

function findLocation(payload, references) {
  const district = normalizeLookup(payload.district);
  const mandal = normalizeLookup(payload.mandal);
  const village = normalizeLookup(payload.village);
  if (!district || !mandal || !village) return null;
  return uniqueMatch(references.locations, (location) => normalizeLookup(location.district) === district
    && normalizeLookup(location.mandal) === mandal
    && normalizeLookup(location.village) === village);
}

function findCollector(employeeCode, references) {
  const lookup = normalizeLookup(employeeCode);
  if (!lookup) return null;
  return uniqueMatch(references.employees || [], (employee) => normalizeLookup(employee.employeeCode) === lookup);
}

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) reasons.push(reason);
}

function analyzeIdentity(row, key) {
  const payload = row.payload;
  const rawName = row.sourceSystem === 'ZOHO_CRM'
    ? (normalizeText(payload.leadName) || normalizeText(payload.lastName))
    : normalizeText(payload.farmerName);
  const name = boundedText(rawName, 160);
  const phone = normalizePhone(payload.phone);
  const reasons = [];
  if (!name.value) addReason(reasons, name.reason || 'MISSING_CUSTOMER_NAME');
  if (!phone.value) addReason(reasons, phone.reason);
  return {
    name: name.value,
    normalizedName: normalizeLookup(name.value),
    phone: phone.value,
    phoneFingerprint: phone.value ? phoneFingerprint(phone.value, key) : null,
    recipientLast4: phone.value ? phone.value.slice(-4) : null,
    reasons,
  };
}

function analyzeCrm(row, identity, references) {
  const reasons = [...identity.reasons];
  const acreage = normalizeDecimal(row.payload.acres);
  const serviceDate = parseDateOnly(row.payload.serviceDate);
  const crop = findCrop(row.payload.crop, references);
  const operatingCenter = findCenter(row.payload.zone, references);
  if (!acreage.value) addReason(reasons, acreage.reason);
  if (!serviceDate.value) addReason(reasons, serviceDate.reason);
  if (!normalizeText(row.payload.crop)) addReason(reasons, 'MISSING_CROP');
  else if (!crop) addReason(reasons, 'UNKNOWN_CROP');
  if (!normalizeText(row.payload.zone)) addReason(reasons, 'MISSING_OPERATING_CENTER');
  else if (!operatingCenter) addReason(reasons, 'UNKNOWN_OPERATING_CENTER');
  const city = boundedText(row.payload.city, 160);
  if (city.reason) addReason(reasons, city.reason);
  return {
    reasons,
    canonical: {
      customerName: identity.name,
      phone: identity.phone,
      city: city.value,
      cropId: crop?.id || null,
      operatingCenterId: operatingCenter?.id || null,
      serviceDate: serviceDate.value,
      servicedAcres: acreage.value,
      rawCropName: boundedText(row.payload.crop, 160).value,
      legacyZone: boundedText(row.payload.zone, 160).value,
    },
    safeReferences: {
      cropId: crop?.id || null,
      operatingCenterId: operatingCenter?.id || null,
    },
    proposedOutcome: 'CREATE_HISTORICAL_SERVICE',
  };
}

function analyzeGoogle(row, identity, references) {
  const reasons = [...identity.reasons];
  const acreage = normalizeDecimal(row.payload.acres);
  const visitedAt = parseVisitTimestamp(row.payload.timestamp);
  const crop = findCrop(row.payload.crop, references);
  const location = findLocation(row.payload, references);
  const collector = findCollector(row.payload.employeeCode, references);
  if (!acreage.value) addReason(reasons, acreage.reason);
  if (!visitedAt.value) addReason(reasons, visitedAt.reason);
  if (!normalizeText(row.payload.crop)) addReason(reasons, 'MISSING_CROP');
  else if (!crop) addReason(reasons, 'UNKNOWN_CROP');
  if (!normalizeText(row.payload.village) || !normalizeText(row.payload.mandal) || !normalizeText(row.payload.district)) {
    addReason(reasons, 'INCOMPLETE_ADMINISTRATIVE_LOCATION');
  } else if (!location) addReason(reasons, 'UNKNOWN_ADMINISTRATIVE_LOCATION');

  const optionalFields = [
    ['collectorNameRaw', row.payload.collectorName, 160],
    ['employeeCodeRaw', row.payload.employeeCode, 80],
    ['fertilizerShop', row.payload.fertilizerShop, 240],
    ['expectedSpraying', row.payload.expectedSpraying, 240],
    ['farmerType', row.payload.farmerType, 80],
  ];
  const bounded = {};
  for (const [field, value, maximum] of optionalFields) {
    const result = boundedText(value, maximum);
    bounded[field] = result.value;
    if (result.reason) addReason(reasons, result.reason);
  }

  return {
    reasons,
    canonical: {
      customerName: identity.name,
      phone: identity.phone,
      village: boundedText(row.payload.village, 160).value,
      mandal: boundedText(row.payload.mandal, 120).value,
      district: boundedText(row.payload.district, 120).value,
      cropId: crop?.id || null,
      administrativeLocationId: location?.id || null,
      collectorUserId: collector?.id || null,
      visitedAt: visitedAt.value,
      observedAcres: acreage.value,
      rawCropName: boundedText(row.payload.crop, 160).value,
      ...bounded,
    },
    safeReferences: {
      cropId: crop?.id || null,
      administrativeLocationId: location?.id || null,
      collectorUserId: collector?.id || null,
    },
    proposedOutcome: 'CREATE_VILLAGE_VISIT',
  };
}

function classifyReasons(reasons) {
  if (!reasons.length) return 'VALID';
  const rejected = new Set(['MISSING_CUSTOMER_NAME', 'FIELD_TOO_LONG', 'MISSING_PHONE', 'INVALID_PHONE']);
  return reasons.some((reason) => rejected.has(reason)) ? 'REJECTED' : 'REVIEW_REQUIRED';
}

function applyDuplicateReview(analyses) {
  const byPhone = new Map();
  for (const analysis of analyses) {
    if (!analysis.identity.phoneFingerprint || analysis.status === 'SKIPPED') continue;
    const values = byPhone.get(analysis.identity.phoneFingerprint) || [];
    values.push(analysis);
    byPhone.set(analysis.identity.phoneFingerprint, values);
  }
  for (const group of byPhone.values()) {
    const names = new Set(group.map((item) => item.identity.normalizedName).filter(Boolean));
    const locationSets = new Map();
    for (const item of group) {
      const sourceLocations = locationSets.get(item.row.sourceSystem) || new Set();
      if (item.locationSignature) sourceLocations.add(item.locationSignature);
      locationSets.set(item.row.sourceSystem, sourceLocations);
    }
    const hasLocationConflict = [...locationSets.values()].some((locations) => locations.size > 1);
    if (names.size > 1 || hasLocationConflict) {
      for (const item of group) {
        addReason(item.reasons, names.size > 1 ? 'CONFLICTING_CUSTOMER_IDENTITY' : 'CONFLICTING_CUSTOMER_LOCATION');
        item.status = 'REVIEW_REQUIRED';
        item.reasonCode = item.reasons[0];
      }
    }
  }

  const byNameAndLocation = new Map();
  for (const analysis of analyses) {
    if (analysis.status === 'SKIPPED') continue;
    if (!analysis.identity.normalizedName || !analysis.locationSignature || !analysis.identity.phoneFingerprint) continue;
    const key = `${analysis.row.sourceSystem}:${analysis.identity.normalizedName}:${analysis.locationSignature}`;
    const values = byNameAndLocation.get(key) || [];
    values.push(analysis);
    byNameAndLocation.set(key, values);
  }
  for (const group of byNameAndLocation.values()) {
    if (new Set(group.map((item) => item.identity.phoneFingerprint)).size <= 1) continue;
    for (const item of group) {
      addReason(item.reasons, 'POSSIBLE_DUPLICATE_IDENTITY');
      item.status = 'REVIEW_REQUIRED';
      item.reasonCode = item.reasons[0];
    }
  }
}

function completePriorOutcome(record) {
  return Boolean(record?.customerId
    && ['HistoricalServiceRecord', 'VillageVisit'].includes(record.resultEntityType)
    && record.resultEntityId
    && record.committedAt);
}

function priorExternalKey(sourceSystem, externalRecordId) {
  return `${sourceSystem}:${externalRecordId}`;
}

function applySourceRecordReconciliation(analyses, priorRecords) {
  const priorByExternalId = new Map();
  const priorByFingerprint = new Map();
  for (const record of priorRecords) {
    if (record.externalRecordId) {
      const key = priorExternalKey(record.sourceSystem, record.externalRecordId);
      const values = priorByExternalId.get(key) || [];
      values.push(record);
      priorByExternalId.set(key, values);
    }
    const fingerprintValues = priorByFingerprint.get(record.rowFingerprint) || [];
    fingerprintValues.push(record);
    priorByFingerprint.set(record.rowFingerprint, fingerprintValues);
  }

  const currentByExternalId = new Map();
  for (const analysis of analyses) {
    if (!analysis.row.externalRecordId) continue;
    const key = priorExternalKey(analysis.row.sourceSystem, analysis.row.externalRecordId);
    const values = currentByExternalId.get(key) || [];
    values.push(analysis);
    currentByExternalId.set(key, values);
  }
  for (const values of currentByExternalId.values()) {
    if (values.length < 2) continue;
    for (const analysis of values) {
      addReason(analysis.reasons, 'DUPLICATE_SOURCE_WORKBOOK_ROW_ID');
      analysis.status = 'REVIEW_REQUIRED';
      analysis.reasonCode = analysis.reasons[0];
    }
  }

  for (const analysis of analyses) {
    if (analysis.status === 'SKIPPED' || analysis.reasons.includes('DUPLICATE_SOURCE_WORKBOOK_ROW_ID')) continue;
    let matches = [];
    let matchStrategy = null;
    if (analysis.row.externalRecordId) {
      matches = priorByExternalId.get(priorExternalKey(
        analysis.row.sourceSystem,
        analysis.row.externalRecordId,
      )) || [];
      matchStrategy = matches.length ? 'WORKBOOK_ROW_ID' : null;
    } else {
      matches = priorByFingerprint.get(analysis.row.rowFingerprint) || [];
      matchStrategy = matches.length ? 'ROW_FINGERPRINT' : null;
    }
    if (!matches.length) continue;

    if (analysis.row.externalRecordId) {
      const changed = matches.filter((record) => record.rowFingerprint !== analysis.row.rowFingerprint);
      if (changed.length) {
        const phoneChanged = changed.some((record) => record.phoneFingerprint
          && analysis.identity.phoneFingerprint
          && record.phoneFingerprint !== analysis.identity.phoneFingerprint);
        addReason(
          analysis.reasons,
          phoneChanged
            ? 'SOURCE_WORKBOOK_ROW_ID_PHONE_CONFLICT'
            : 'SOURCE_WORKBOOK_ROW_ID_CONTENT_CONFLICT',
        );
        analysis.status = 'REVIEW_REQUIRED';
        analysis.reasonCode = analysis.reasons[0];
        continue;
      }
    }

    const prior = matches.find(completePriorOutcome);
    if (!prior) {
      addReason(analysis.reasons, 'SOURCE_RECORD_PRIOR_OUTCOME_INCOMPLETE');
      analysis.status = 'REVIEW_REQUIRED';
      analysis.reasonCode = analysis.reasons[0];
      continue;
    }
    analysis.status = 'SKIPPED';
    analysis.reasonCode = 'ALREADY_IMPORTED_SOURCE_RECORD';
    analysis.reasons = ['ALREADY_IMPORTED_SOURCE_RECORD'];
    analysis.proposedOutcome = 'SKIP_ALREADY_IMPORTED_SOURCE_RECORD';
    analysis.existingCustomerId = prior.customerId;
    analysis.priorSourceRecord = prior;
    analysis.sourceMatchStrategy = matchStrategy;
  }
}

async function analyzeRows(rows, references, key, dataAccess = importRepository, { excludeBatchId = null } = {}) {
  for (const row of rows) row.rowFingerprint = sourceRowFingerprint(row, key);
  const identities = rows.map((row) => analyzeIdentity(row, key));
  const priorRecords = await dataAccess.findPriorImportedSourceRecords(
    rows.map((row) => ({
      sourceSystem: row.sourceSystem,
      externalRecordId: row.externalRecordId,
      rowFingerprint: row.rowFingerprint,
    })),
    { excludeBatchId },
  );
  const phones = [...new Set(identities.map((identity) => identity.phone).filter(Boolean))];
  const existingCustomers = await dataAccess.findCustomersByPhones(phones);
  const customerByPhone = new Map(existingCustomers.map((customer) => [customer.phone, customer]));

  const analyses = rows.map((row, index) => {
    const identity = identities[index];
    if (row.empty) {
      return {
        row,
        identity,
        status: 'SKIPPED',
        reasonCode: 'EMPTY_ROW',
        reasons: ['EMPTY_ROW'],
        canonical: null,
        safeReferences: {},
        proposedOutcome: 'SKIP_EMPTY_ROW',
        existingCustomerId: null,
      };
    }
    const source = row.sourceSystem === 'ZOHO_CRM'
      ? analyzeCrm(row, identity, references)
      : analyzeGoogle(row, identity, references);
    if (row.externalRecordIdReason) addReason(source.reasons, row.externalRecordIdReason);
    const existingCustomer = identity.phone ? customerByPhone.get(identity.phone) : null;
    if (existingCustomer
      && identity.normalizedName
      && normalizeLookup(existingCustomer.displayName) !== identity.normalizedName) {
      addReason(source.reasons, 'EXISTING_CUSTOMER_IDENTITY_REVIEW');
    }
    if (existingCustomer && !existingCustomer.active) addReason(source.reasons, 'INACTIVE_CUSTOMER_REVIEW');
    const locationSignature = row.sourceSystem === 'ZOHO_CRM'
      ? normalizeLookup(row.payload.city)
      : [row.payload.district, row.payload.mandal, row.payload.village].map(normalizeLookup).join('|');
    return {
      row,
      identity,
      ...source,
      locationSignature,
      status: classifyReasons(source.reasons),
      reasonCode: source.reasons[0] || null,
      existingCustomerId: existingCustomer?.id || null,
    };
  });
  applySourceRecordReconciliation(analyses, priorRecords);
  applyDuplicateReview(analyses);
  for (const analysis of analyses) {
    analysis.canonicalDigest = keyedDigest('canonical-plan-v1', analysis.canonical, key);
  }
  return analyses;
}

function safePlanRows(analyses) {
  return analyses.map((analysis) => ({
    sourceSystem: analysis.row.sourceSystem,
    sheetName: analysis.row.sheetName,
    sourceRowNumber: analysis.row.sourceRowNumber,
    externalRecordId: analysis.row.externalRecordId,
    rowFingerprint: analysis.rowFingerprint || analysis.row.rowFingerprint,
    canonicalDigest: analysis.canonicalDigest,
    phoneFingerprint: analysis.identity.phoneFingerprint,
    status: analysis.status,
    reasonCode: analysis.reasonCode,
    proposedOutcome: analysis.proposedOutcome,
    existingCustomerId: analysis.existingCustomerId,
    priorSourceRecordId: analysis.priorSourceRecord?.id || null,
    sourceMatchStrategy: analysis.sourceMatchStrategy || null,
    references: analysis.safeReferences,
  })).sort((a, b) => a.sheetName.localeCompare(b.sheetName) || a.sourceRowNumber - b.sourceRowNumber);
}

function countsFor(analyses) {
  const plannedStatus = (item) => (item.status === 'VALID'
    && typeof item.proposedOutcome === 'string'
    && item.proposedOutcome.startsWith('SKIP_')
    ? 'SKIPPED'
    : item.status);
  return {
    totalRows: analyses.length,
    validRows: analyses.filter((item) => plannedStatus(item) === 'VALID').length,
    rejectedRows: analyses.filter((item) => item.status === 'REJECTED').length,
    reviewRows: analyses.filter((item) => item.status === 'REVIEW_REQUIRED').length,
    skippedRows: analyses.filter((item) => plannedStatus(item) === 'SKIPPED').length,
  };
}

function safePreparedReport(batchId, analyses, referencesFingerprint, planHash) {
  const counts = countsFor(analyses);
  const committable = analyses.filter((analysis) => analysis.status === 'VALID');
  const newCustomerFingerprints = new Set(committable
    .filter((analysis) => !analysis.existingCustomerId)
    .map((analysis) => analysis.identity.phoneFingerprint)
    .filter(Boolean));
  const matchedCustomerIds = new Set(committable
    .map((analysis) => analysis.existingCustomerId)
    .filter(Boolean));
  const sheets = {};
  for (const analysis of analyses) {
    const sheet = sheets[analysis.row.sheetName] || {
      sourceSystem: analysis.row.sourceSystem,
      totalRows: 0,
      validRows: 0,
      rejectedRows: 0,
      reviewRows: 0,
      skippedRows: 0,
    };
    sheet.totalRows += 1;
    const counter = `${analysis.status.toLowerCase().replace('_required', '')}Rows`;
    if (Object.hasOwn(sheet, counter)) sheet[counter] += 1;
    sheets[analysis.row.sheetName] = sheet;
  }
  return {
    batchId,
    mappingVersion: MAPPING_VERSION,
    status: counts.rejectedRows || counts.reviewRows ? 'REVIEW_REQUIRED' : 'VALIDATED',
    counts,
    sheets,
    customerResolution: {
      newCustomerCandidates: newCustomerFingerprints.size,
      matchedCustomers: matchedCustomerIds.size,
      possibleDuplicateRows: analyses.filter((analysis) => analysis.reasons.includes('POSSIBLE_DUPLICATE_IDENTITY')).length,
      conflictingIdentityRows: analyses.filter((analysis) => analysis.reasons.some((reason) => reason.startsWith('CONFLICTING_CUSTOMER_'))).length,
      existingCustomerIdentityReviewRows: analyses.filter((analysis) => analysis.reasons.includes('EXISTING_CUSTOMER_IDENTITY_REVIEW')).length,
      inactiveCustomerReviewRows: analyses.filter((analysis) => analysis.reasons.includes('INACTIVE_CUSTOMER_REVIEW')).length,
    },
    plannedOutcomes: {
      historicalServices: committable.filter((analysis) => analysis.row.sourceSystem === 'ZOHO_CRM').length,
      villageVisits: committable.filter((analysis) => analysis.row.sourceSystem === 'GOOGLE_FORMS').length,
    },
    validationSummary: {
      unknownCropRows: analyses.filter((analysis) => analysis.reasons.includes('UNKNOWN_CROP')).length,
      invalidLocationRows: analyses.filter((analysis) => analysis.reasons.some((reason) => [
        'INCOMPLETE_ADMINISTRATIVE_LOCATION',
        'UNKNOWN_ADMINISTRATIVE_LOCATION',
      ].includes(reason))).length,
    },
    referenceDataFingerprint: referencesFingerprint,
    dryRunPlanHash: planHash,
  };
}

function createStagedRecord(batchId, analysis, key, keyVersion, expiresAt) {
  const id = crypto.randomUUID();
  const rowFingerprint = analysis.row.rowFingerprint || sourceRowFingerprint(analysis.row, key);
  analysis.rowFingerprint = rowFingerprint;
  analysis.row.rowFingerprint = rowFingerprint;
  const encrypted = encryptPayload({
    payload: encodeDates(analysis.row.payload),
    rawCells: analysis.row.rawCells,
    empty: analysis.row.empty,
  }, key, {
    batchId,
    sheetName: analysis.row.sheetName,
    sourceRowNumber: analysis.row.sourceRowNumber,
  });
  return {
    id,
    batchId,
    sourceSystem: analysis.row.sourceSystem,
    sheetName: analysis.row.sheetName,
    sourceRowNumber: analysis.row.sourceRowNumber,
    externalRecordId: analysis.row.externalRecordId,
    rowFingerprint,
    phoneFingerprint: analysis.identity.phoneFingerprint,
    recipientLast4: analysis.identity.recipientLast4,
    // A planned skip is not terminal until the approved commit links it to its
    // prior outcome (or records the empty-row decision). Store it as VALID so
    // the database's terminal SourceRecord immutability guard remains intact.
    status: analysis.status === 'SKIPPED' ? 'VALID' : analysis.status,
    reasonCode: analysis.reasonCode,
    safeDetails: {
      reasonCodes: analysis.reasons,
      existingCustomerId: analysis.existingCustomerId,
      priorSourceRecordId: analysis.priorSourceRecord?.id || null,
      sourceMatchStrategy: analysis.sourceMatchStrategy || null,
      references: analysis.safeReferences,
    },
    proposedOutcome: analysis.proposedOutcome,
    encryptedPayload: encrypted.encryptedPayload,
    payloadIv: encrypted.payloadIv,
    payloadAuthTag: encrypted.payloadAuthTag,
    encryptionKeyVersion: keyVersion,
    payloadExpiresAt: expiresAt,
  };
}

async function preflight({ filePath }) {
  const result = await preflightWorkbook(filePath);
  return result.safeSummary;
}

async function prepare({
  filePath,
  actorId = null,
  key,
  keyVersion = 'v1',
  retentionDays = DEFAULT_RETENTION_DAYS,
  resumeBatchId = null,
  resumeConfirmation = null,
} = {}) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw importError('IMPORT_STAGING_KEY_INVALID', 'A valid staging key is required');
  const days = Number(retentionDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
    throw importError('IMPORT_RETENTION_INVALID', 'Retention must be between 1 and 30 days');
  }
  const preflightResult = await preflightWorkbook(filePath);
  const duplicate = await importRepository.findBatchByChecksumMapping(preflightResult.fileChecksum, MAPPING_VERSION);
  if (duplicate && (resumeBatchId !== duplicate.id || resumeConfirmation !== `REPREPARE_IMPORT_${duplicate.id}`)) {
    throw importError(
      'IMPORT_WORKBOOK_ALREADY_STAGED',
      `This workbook version is batch ${duplicate.id}; exact re-prepare authorization is required`,
      409,
    );
  }

  const references = await importRepository.getReferenceData();
  if (!(references.languages || []).some((language) => language.code === 'und' && language.active)) {
    throw importError(
      'IMPORT_UNKNOWN_LANGUAGE_MASTER_REQUIRED',
      'The active unknown/unrecorded language master is required before preparing an import',
      409,
    );
  }
  const rows = mapWorkbookRows(preflightResult.sheets);
  const analyses = await analyzeRows(rows, references, key);
  const batchId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  const records = analyses.map((analysis) => createStagedRecord(batchId, analysis, key, keyVersion, expiresAt));
  const referenceDataFingerprint = fingerprintReferences(references);
  const dryRunPlanHash = sha256(safePlanRows(analyses));
  const safeReport = safePreparedReport(batchId, analyses, referenceDataFingerprint, dryRunPlanHash);
  const counts = countsFor(analyses);
  const batch = {
    id: batchId,
    ...(!duplicate ? { attemptNumber: 1, supersedesBatchId: null } : {}),
    sourceType: 'FARMER_WORKBOOK',
    originalFileName: path.basename(preflightResult.originalFileName),
    fileSizeBytes: BigInt(preflightResult.fileSizeBytes),
    workbookType: 'XLSX',
    fileChecksum: preflightResult.fileChecksum,
    mappingVersion: MAPPING_VERSION,
    dryRunPlanHash,
    referenceDataFingerprint,
    status: safeReport.status,
    ...counts,
    importedRows: 0,
    safeReport,
    rawRetentionUntil: expiresAt,
    createdByUserId: actorId,
  };
  const created = duplicate
    ? await importRepository.createSupersedingPreparedBatch({
      priorBatchId: duplicate.id,
      batch,
      records,
      actorId,
      confirmation: resumeConfirmation,
    })
    : await importRepository.createPreparedBatch({ batch, records, actorId });
  return safeBatch(created);
}

async function report({ batchId } = {}) {
  const batch = await importRepository.getBatchWithSafeRecords(batchId);
  if (!batch) throw importError('IMPORT_BATCH_NOT_FOUND', 'Import batch not found', 404);
  return {
    ...safeBatch(batch),
    records: (batch.sourceRecords || []).map(safeRecord),
  };
}

function requireReference(value, code, label, maximum = 160) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.length > maximum || /[\r\n]/u.test(normalized)) {
    throw importError(code, `${label} is required and must be a short single-line reference`);
  }
  return normalized;
}

async function approve({
  batchId,
  adminId,
  approvalReference,
  backupEvidenceReference,
  expectedDeploymentName,
} = {}) {
  const normalizedApprovalReference = requireReference(approvalReference, 'IMPORT_APPROVAL_REFERENCE_INVALID', 'Approval reference');
  const normalizedBackupReference = requireReference(backupEvidenceReference, 'IMPORT_BACKUP_REFERENCE_INVALID', 'Backup evidence reference');
  const normalizedDeploymentName = requireReference(expectedDeploymentName, 'IMPORT_DEPLOYMENT_INVALID', 'Deployment name', 120);
  const batch = await importRepository.getBatchWithSafeRecords(batchId);
  if (!batch) throw importError('IMPORT_BATCH_NOT_FOUND', 'Import batch not found', 404);
  const idempotentApproval = batch.status === 'APPROVED'
    && batch.approvedByUserId === adminId
    && batch.approvalReference === normalizedApprovalReference
    && batch.backupEvidenceReference === normalizedBackupReference
    && batch.expectedDeploymentName === normalizedDeploymentName;
  if (!idempotentApproval
    && (batch.status !== 'VALIDATED' || batch.rejectedRows !== 0 || batch.reviewRows !== 0)) {
    throw importError('IMPORT_BATCH_NOT_APPROVABLE', 'Only a fully validated batch can be approved', 409);
  }
  const updated = await importRepository.approveBatch({
    batchId,
    adminId,
    approvalReference: normalizedApprovalReference,
    backupEvidenceReference: normalizedBackupReference,
    expectedDeploymentName: normalizedDeploymentName,
    validate: async (_transaction, lockedBatch, actions) => {
      const preparedCounts = countsFor(lockedBatch.sourceRecords.map((record) => ({
        status: record.status,
        proposedOutcome: record.proposedOutcome,
      })));
      if (preparedCounts.totalRows !== lockedBatch.totalRows
        || preparedCounts.validRows !== lockedBatch.validRows
        || preparedCounts.rejectedRows !== lockedBatch.rejectedRows
        || preparedCounts.reviewRows !== lockedBatch.reviewRows
        || preparedCounts.skippedRows !== lockedBatch.skippedRows) {
        throw importError('IMPORT_PREPARED_RECORD_DRIFT', 'Prepared row counts changed before approval', 409);
      }
      const now = Date.now();
      if (lockedBatch.sourceRecords.some((record) => new Date(record.payloadExpiresAt).getTime() <= now
        || !record.encryptedPayload.length || !record.payloadIv.length || !record.payloadAuthTag.length)) {
        throw importError('IMPORT_PAYLOAD_UNAVAILABLE', 'A staged payload is expired or unavailable', 409);
      }
      const currentReferenceFingerprint = fingerprintReferences(await actions.getReferenceData());
      if (currentReferenceFingerprint !== lockedBatch.referenceDataFingerprint) {
        throw importError('IMPORT_REFERENCE_DATA_DRIFT', 'Reference data changed after preparation; prepare a new dry run', 409);
      }
    },
  });
  return safeBatch(updated);
}

function hydrateRows(records, key) {
  const now = Date.now();
  return records.map((record) => {
    if (new Date(record.payloadExpiresAt).getTime() <= now) {
      throw importError('IMPORT_PAYLOAD_EXPIRED', 'Staged import payload has expired', 409);
    }
    if (!record.encryptedPayload.length || !record.payloadIv.length || !record.payloadAuthTag.length) {
      throw importError('IMPORT_PAYLOAD_UNAVAILABLE', 'Staged import payload is unavailable', 409);
    }
    const decrypted = decryptPayload(record, key);
    if (!decrypted || typeof decrypted.payload !== 'object' || !Array.isArray(decrypted.rawCells)) {
      throw importError('IMPORT_PAYLOAD_STRUCTURE_INVALID', 'Staged import payload structure is invalid', 409);
    }
    const row = {
      sourceSystem: record.sourceSystem,
      sheetName: record.sheetName,
      sourceRowNumber: record.sourceRowNumber,
      externalRecordId: record.externalRecordId,
      externalRecordIdReason: null,
      payload: decodeDates(decrypted.payload),
      rawCells: decrypted.rawCells,
      empty: Boolean(decrypted.empty),
      stagedRecord: record,
    };
    const recomputedFingerprint = sourceRowFingerprint(row, key);
    const storedFingerprint = Buffer.from(String(record.rowFingerprint || ''), 'hex');
    const computedFingerprint = Buffer.from(recomputedFingerprint, 'hex');
    if (storedFingerprint.length !== computedFingerprint.length
      || !crypto.timingSafeEqual(storedFingerprint, computedFingerprint)) {
      throw importError('IMPORT_ROW_FINGERPRINT_MISMATCH', 'Staged source data no longer matches its approved fingerprint', 409);
    }
    row.rowFingerprint = recomputedFingerprint;
    return row;
  });
}

function assertCommitEnvironment(batch, deploymentName, confirmation) {
  if (batch.status === 'COMPLETED') return;
  if (batch.status !== 'APPROVED') throw importError('IMPORT_BATCH_NOT_APPROVED', 'Import batch is not approved', 409);
  if (confirmation !== `COMMIT_IMPORT_${batch.id}`) {
    throw importError('IMPORT_COMMIT_CONFIRMATION_INVALID', 'The exact batch confirmation phrase is required');
  }
  if (!deploymentName || deploymentName !== batch.expectedDeploymentName) {
    throw importError('IMPORT_DEPLOYMENT_MISMATCH', 'The current deployment does not match the approved target', 409);
  }
}

async function commit({ batchId, confirmation, key, deploymentName } = {}) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw importError('IMPORT_STAGING_KEY_INVALID', 'A valid staging key is required');
  const batch = await importRepository.getBatchWithSafeRecords(batchId);
  if (!batch) throw importError('IMPORT_BATCH_NOT_FOUND', 'Import batch not found', 404);
  assertCommitEnvironment(batch, deploymentName, confirmation);
  if (batch.status === 'COMPLETED') return safeBatch(batch);

  const result = await importRepository.commitBatch({
    batchId,
    actorId: batch.approvedByUserId,
    actualDeploymentName: deploymentName,
    execute: async (_transaction, lockedBatch, actions) => {
      if (lockedBatch.status === 'COMPLETED') return { importedRows: lockedBatch.importedRows, skippedRows: lockedBatch.skippedRows };
      if (lockedBatch.status !== 'APPROVED') throw importError('IMPORT_BATCH_STATE_CHANGED', 'The import batch state changed before commit', 409);
      const references = await actions.getReferenceData();
      const rows = hydrateRows(lockedBatch.sourceRecords, key);
      const analyses = await analyzeRows(rows, references, key, actions, { excludeBatchId: lockedBatch.id });
      const currentReferenceFingerprint = fingerprintReferences(references);
      const currentPlanHash = sha256(safePlanRows(analyses));
      if (currentReferenceFingerprint !== lockedBatch.referenceDataFingerprint) {
        throw importError('IMPORT_REFERENCE_DATA_DRIFT', 'Reference data changed after approval; prepare a new dry run', 409);
      }
      if (currentPlanHash !== lockedBatch.dryRunPlanHash) {
        throw importError('IMPORT_PLAN_DRIFT', 'The approved import plan no longer matches current data', 409);
      }
      if (analyses.some((analysis) => !['VALID', 'SKIPPED'].includes(analysis.status))) {
        throw importError('IMPORT_ROWS_NOT_COMMITTABLE', 'The batch contains rows that require correction or review', 409);
      }
      const customersByPhone = new Map();
      let importedRows = 0;
      let skippedRows = 0;
      const reconciliation = [];

      for (const analysis of analyses) {
        const sourceRecord = analysis.row.stagedRecord;
        if (analysis.status === 'SKIPPED') {
          const prior = analysis.priorSourceRecord;
          const duplicateSkip = analysis.reasonCode === 'ALREADY_IMPORTED_SOURCE_RECORD' && completePriorOutcome(prior);
          const finalOutcome = duplicateSkip
            ? 'SKIPPED_ALREADY_IMPORTED_SOURCE_RECORD'
            : 'SKIPPED_EMPTY_ROW';
          await actions.updateSourceRecord(sourceRecord.id, {
            status: 'SKIPPED',
            finalOutcome,
            customerId: duplicateSkip ? prior.customerId : null,
            resultEntityType: duplicateSkip ? prior.resultEntityType : null,
            resultEntityId: duplicateSkip ? prior.resultEntityId : null,
            committedAt: new Date(),
          });
          skippedRows += 1;
          reconciliation.push({
            sourceRecordId: sourceRecord.id,
            finalOutcome,
            ...(duplicateSkip ? {
              customerId: prior.customerId,
              entityType: prior.resultEntityType,
              entityId: prior.resultEntityId,
            } : {}),
          });
          continue;
        }

        let customer = customersByPhone.get(analysis.canonical.phone);
        if (!customer) {
          customer = await actions.findCustomerByPhone(analysis.canonical.phone);
          if (!customer) {
            const customerData = {
              displayName: analysis.canonical.customerName,
              phone: analysis.canonical.phone,
              preferredLanguage: 'und',
              createdByImportBatchId: lockedBatch.id,
            };
            if (analysis.row.sourceSystem === 'GOOGLE_FORMS') {
              customerData.village = analysis.canonical.village;
              customerData.mandal = analysis.canonical.mandal;
              customerData.district = analysis.canonical.district;
            }
            customer = await actions.createCustomer(customerData);
          }
          customersByPhone.set(analysis.canonical.phone, customer);
        }

        let entity;
        let entityType;
        if (analysis.row.sourceSystem === 'ZOHO_CRM') {
          entityType = 'HistoricalServiceRecord';
          entity = await actions.createHistoricalService({
              customerId: customer.id,
              sourceRecordId: sourceRecord.id,
              cropId: analysis.canonical.cropId,
              operatingCenterId: analysis.canonical.operatingCenterId,
              serviceDate: analysis.canonical.serviceDate,
              rawCropName: analysis.canonical.rawCropName,
              servicedAcres: analysis.canonical.servicedAcres,
              legacyZone: analysis.canonical.legacyZone,
              status: 'COMPLETED',
          });
        } else {
          entityType = 'VillageVisit';
          entity = await actions.createVillageVisit({
              customerId: customer.id,
              sourceRecordId: sourceRecord.id,
              collectorUserId: analysis.canonical.collectorUserId,
              collectorNameRaw: analysis.canonical.collectorNameRaw,
              employeeCodeRaw: analysis.canonical.employeeCodeRaw,
              administrativeLocationId: analysis.canonical.administrativeLocationId,
              cropId: analysis.canonical.cropId,
              visitedAt: analysis.canonical.visitedAt,
              rawCropName: analysis.canonical.rawCropName,
              observedAcres: analysis.canonical.observedAcres,
              fertilizerShop: analysis.canonical.fertilizerShop,
              expectedSpraying: analysis.canonical.expectedSpraying,
              farmerType: analysis.canonical.farmerType,
          });
        }
        await actions.updateSourceRecord(sourceRecord.id, {
            status: 'IMPORTED',
            finalOutcome: `CREATED_${entityType.toUpperCase()}`,
            customerId: customer.id,
            resultEntityType: entityType,
            resultEntityId: entity.id,
            committedAt: new Date(),
        });
        importedRows += 1;
        reconciliation.push({ sourceRecordId: sourceRecord.id, customerId: customer.id, entityType, entityId: entity.id });
      }
      return {
        importedRows,
        skippedRows,
        reconciliationChecksum: sha256(reconciliation),
      };
    },
  });
  return safeBatch(result);
}

async function verify({ batchId } = {}) {
  const verification = await importRepository.verifyBatch(batchId);
  if (!verification) throw importError('IMPORT_BATCH_NOT_FOUND', 'Import batch not found', 404);
  return { ...verification, ok: verification.consistent };
}

async function abort({ batchId, actorId = null, confirmation } = {}) {
  if (confirmation !== `ABORT_IMPORT_${batchId}`) {
    throw importError('IMPORT_ABORT_CONFIRMATION_INVALID', 'The exact batch abort phrase is required');
  }
  const result = await importRepository.abortBatch({ batchId, actorId });
  return safeBatch(result);
}

async function purge({ batchId, actorId, confirmation } = {}) {
  if (confirmation !== `PURGE_IMPORT_${batchId}`) {
    throw importError('IMPORT_PURGE_CONFIRMATION_INVALID', 'The exact batch purge phrase is required');
  }
  return importRepository.purgeExpiredPayloads({ batchId, actorId });
}

module.exports = {
  abort,
  approve,
  commit,
  prepare,
  preflight,
  purge,
  report,
  verify,
  _private: {
    analyzeRows,
    fingerprintReferences,
    safePlanRows,
    sha256,
  },
};
