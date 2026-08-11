const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const prisma = require('../src/lib/prisma');
const importer = require('../services/farmerDataImportService');
const { SHEETS } = require('../importer/farmerDataV1');
const { PREFLIGHT_LIMITS } = require('../importer/xlsxPreflight');
const { decryptPayload, encryptPayload } = require('../importer/stagingCrypto');

const runId = `${process.pid}-${Date.now()}`;
const stagingKey = crypto.randomBytes(32);
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rfly-phase21-'));
const ids = {
  batches: [],
  customers: [],
  users: [],
  crops: [],
  centers: [],
  locations: [],
};
let admin;
let collector;
let crop;
let center;
let location;
let initialLeadCount;
let initialUserCount;

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function columnName(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function worksheetXml(rows) {
  const xmlRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

function createSyntheticWorkbook(fileName, {
  phoneSuffix = '10',
  cropName,
  invalidCrop = false,
  visitTimestamp = '07/31/2026 10:15:00 AM',
  crmSerial = phoneSuffix,
  googleSerial = phoneSuffix,
  zoneName = null,
  villageName = null,
  mandalName = null,
  districtName = null,
  crmPhoneValue = null,
  googlePhoneValue = null,
} = {}) {
  const crmPhone = crmPhoneValue ?? `98765432${phoneSuffix}`;
  const googlePhone = googlePhoneValue ?? `97654321${phoneSuffix}`;
  const selectedCrop = invalidCrop ? `Unknown crop ${runId}` : cropName;
  const crmRows = [
    [...SHEETS.CRM.headers],
    [crmSerial, 'One', `Synthetic CRM farmer ${runId}-${phoneSuffix}`, crmPhone, 'Synthetic CRM city', '2.50', '15/01/2026', selectedCrop, zoneName || center.name],
  ];
  const googleRows = [
    [...SHEETS.GOOGLE.headers],
    [googleSerial, visitTimestamp, 'Synthetic Collector', collector.employeeCode, villageName || location.village, mandalName || location.mandal, districtName || location.district, `Synthetic Google farmer ${runId}-${phoneSuffix}`, googlePhone, selectedCrop, '3.00', 'Synthetic Shop', 'Next month', '', '', 'Owner'],
  ];
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
      </Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="${xmlEscape(SHEETS.CRM.name)}" sheetId="1" r:id="rId1"/>
          <sheet name="${xmlEscape(SHEETS.GOOGLE.name)}" sheetId="2" r:id="rId2"/>
        </sheets>
      </workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
        <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
        <borders count="1"><border/></borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
      </styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(worksheetXml(crmRows)),
    'xl/worksheets/sheet2.xml': strToU8(worksheetXml(googleRows)),
  };
  const target = path.join(temporaryDirectory, fileName);
  fs.writeFileSync(target, Buffer.from(zipSync(files, { level: 0 })));
  return target;
}

function rewriteWorkbook(source, fileName, transform) {
  const bytes = fs.readFileSync(source);
  const archive = unzipSync(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  transform(archive);
  const target = path.join(temporaryDirectory, fileName);
  fs.writeFileSync(target, Buffer.from(zipSync(archive, { level: 0 })));
  return target;
}

function rewriteWorkbookMetadata(source, fileName, marker) {
  return rewriteWorkbook(source, fileName, (archive) => {
    const xml = Buffer.from(archive['xl/workbook.xml']).toString('utf8');
    archive['xl/workbook.xml'] = strToU8(xml.replace(
      '</workbook>',
      `<calcPr calcId="${Number(marker)}"/></workbook>`,
    ));
  });
}

function forgeCentralDirectorySize(source, fileName, uncompressedSize) {
  const bytes = Buffer.from(fs.readFileSync(source));
  const centralEntryOffset = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.notEqual(centralEntryOffset, -1);
  bytes.writeUInt32LE(uncompressedSize, centralEntryOffset + 24);
  const target = path.join(temporaryDirectory, fileName);
  fs.writeFileSync(target, bytes);
  return target;
}

function immutableSourceEvidence(records) {
  return records.map((record) => ({
    id: record.id,
    status: record.status,
    reasonCode: record.reasonCode,
    finalOutcome: record.finalOutcome,
    rowFingerprint: record.rowFingerprint,
    phoneFingerprint: record.phoneFingerprint,
    recipientLast4: record.recipientLast4,
    encryptedPayload: Buffer.from(record.encryptedPayload).toString('hex'),
    payloadIv: Buffer.from(record.payloadIv).toString('hex'),
    payloadAuthTag: Buffer.from(record.payloadAuthTag).toString('hex'),
    payloadExpiresAt: record.payloadExpiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

async function mutateTerminalSourceEvidenceForTest(sourceRecordId, data) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    return transaction.sourceRecord.update({ where: { id: sourceRecordId }, data });
  });
}

test.before(async () => {
  initialLeadCount = await prisma.lead.count();
  initialUserCount = await prisma.user.count();
  [admin, collector] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Phase 21 Admin',
        email: `phase21-admin-${runId}@example.test`,
        passwordHash: 'not-used-by-import-test',
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Phase 21 Collector',
        email: `phase21-collector-${runId}@example.test`,
        employeeCode: `P21-${runId}`,
        passwordHash: 'not-used-by-import-test',
        role: 'PILOT',
      },
    }),
  ]);
  ids.users.push(admin.id, collector.id);
  [crop, center, location] = await Promise.all([
    prisma.crop.create({
      data: {
        code: `p21-${runId}`.slice(0, 40),
        displayName: `Phase crop ${runId}`.slice(0, 120),
        normalizedName: `phase-crop-${runId}`.slice(0, 120),
      },
    }),
    prisma.operatingCenter.create({
      data: {
        code: `P21C-${runId}`.slice(0, 40),
        name: `Phase center ${runId}`,
        latitude: 11,
        longitude: 77,
      },
    }),
    prisma.location.create({
      data: {
        district: `Phase district ${runId}`,
        mandal: `Phase mandal ${runId}`,
        village: `Phase village ${runId}`,
        normalizedKey: `in|phase-district-${runId}|phase-mandal-${runId}|phase-village-${runId}`,
      },
    }),
  ]);
  ids.crops.push(crop.id);
  ids.centers.push(center.id);
  ids.locations.push(location.id);
});

test('farmer workbook import is staged, approved and committed without creating leads or users', async () => {
  const workbook = createSyntheticWorkbook('valid.xlsx', { phoneSuffix: '10', cropName: crop.displayName });
  const existingCustomer = await prisma.customer.create({
    data: {
      displayName: `Synthetic CRM farmer ${runId}-10`,
      phone: '+919876543210',
    },
  });
  ids.customers.push(existingCustomer.id);
  const preflight = await importer.preflight({ filePath: workbook });
  assert.equal(preflight.accepted, true);
  assert.deepEqual(preflight.sheets.map((sheet) => sheet.dataRowCount), [1, 1]);
  const cliPreflight = spawnSync(process.execPath, ['importer/cli.js', 'preflight', '--file', workbook], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(cliPreflight.status, 0, cliPreflight.stderr);
  assert.doesNotMatch(`${cliPreflight.stdout}${cliPreflight.stderr}`, /Synthetic|9876543210|9765432110|Phase village/u);
  const formulaWorkbook = rewriteWorkbook(workbook, 'formula.xlsx', (archive) => {
    const xml = Buffer.from(archive['xl/worksheets/sheet1.xml']).toString('utf8');
    archive['xl/worksheets/sheet1.xml'] = strToU8(xml.replace('</c>', '<f>1+1</f></c>'));
  });
  await assert.rejects(() => importer.preflight({ filePath: formulaWorkbook }), (error) => error.code === 'FORMULA_NOT_ALLOWED');
  const macroWorkbook = rewriteWorkbook(workbook, 'macro.xlsx', (archive) => {
    archive['xl/vbaProject.bin'] = new Uint8Array([1, 2, 3]);
  });
  await assert.rejects(() => importer.preflight({ filePath: macroWorkbook }), (error) => error.code === 'ACTIVE_WORKBOOK_CONTENT');
  const traversalWorkbook = rewriteWorkbook(workbook, 'path-traversal.xlsx', (archive) => {
    archive['../escape.xml'] = strToU8('<escape/>');
  });
  await assert.rejects(() => importer.preflight({ filePath: traversalWorkbook }), (error) => error.code === 'UNSAFE_ZIP_PATH');
  const externalRelationshipWorkbook = rewriteWorkbook(workbook, 'external-relationship.xlsx', (archive) => {
    const xml = Buffer.from(archive['_rels/.rels']).toString('utf8');
    archive['_rels/.rels'] = strToU8(xml.replace(
      '</Relationships>',
      '<Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///tmp/unsafe.dotx" TargetMode="External"/></Relationships>',
    ));
  });
  await assert.rejects(
    () => importer.preflight({ filePath: externalRelationshipWorkbook }),
    (error) => error.code === 'EXTERNAL_RELATIONSHIP',
  );
  const oversizedWorkbook = forgeCentralDirectorySize(
    workbook,
    'oversized-entry.xlsx',
    PREFLIGHT_LIMITS.maximumSingleEntryBytes + 1,
  );
  await assert.rejects(() => importer.preflight({ filePath: oversizedWorkbook }), (error) => error.code === 'SUSPICIOUS_ZIP');
  const wrongHeaderWorkbook = rewriteWorkbook(workbook, 'wrong-header.xlsx', (archive) => {
    const xml = Buffer.from(archive['xl/worksheets/sheet1.xml']).toString('utf8');
    archive['xl/worksheets/sheet1.xml'] = strToU8(xml.replace('S.NO', 'Unexpected'));
  });
  await assert.rejects(() => importer.preflight({ filePath: wrongHeaderWorkbook }), (error) => error.code === 'HEADER_MISMATCH');
  const cliRejected = spawnSync(process.execPath, ['importer/cli.js', 'preflight', '--file', wrongHeaderWorkbook], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: process.env,
  });
  assert.notEqual(cliRejected.status, 0);
  assert.doesNotMatch(`${cliRejected.stdout}${cliRejected.stderr}`, /Synthetic|9876543210|9765432110|Phase village/u);

  const prepared = await importer.prepare({ filePath: workbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(prepared.id);
  assert.equal(prepared.attemptNumber, 1);
  assert.equal(prepared.supersedesBatchId, null);
  assert.equal(prepared.status, 'VALIDATED');
  assert.equal(prepared.validRows, 2);
  assert.equal(prepared.reviewRows, 0);
  assert.equal(prepared.rejectedRows, 0);
  assert.equal(prepared.safeReport.customerResolution.newCustomerCandidates, 1);
  assert.equal(prepared.safeReport.customerResolution.matchedCustomers, 1);
  assert.equal(prepared.safeReport.plannedOutcomes.historicalServices, 1);
  assert.equal(prepared.safeReport.plannedOutcomes.villageVisits, 1);

  const stagedRecords = await prisma.sourceRecord.findMany({ where: { batchId: prepared.id } });
  assert.equal(stagedRecords.length, 2);
  assert.deepEqual(stagedRecords.map((record) => record.externalRecordId).sort(), ['10', '10']);
  const stagedBytes = Buffer.concat(stagedRecords.map((record) => record.encryptedPayload)).toString('utf8');
  assert.doesNotMatch(stagedBytes, /Synthetic CRM farmer|Synthetic Google farmer|9876543210/u);
  assert.equal(await prisma.customer.count({ where: { createdByImportBatchId: prepared.id } }), 0);
  assert.equal(await prisma.historicalServiceRecord.count({ where: { sourceRecord: { batchId: prepared.id } } }), 0);
  assert.equal(await prisma.villageVisit.count({ where: { sourceRecord: { batchId: prepared.id } } }), 0);

  await importer.approve({
    batchId: prepared.id,
    adminId: admin.id,
    approvalReference: `P21-approval-${runId}`,
    backupEvidenceReference: `P21-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  });
  await prisma.user.update({ where: { id: admin.id }, data: { active: false } });
  await assert.rejects(() => importer.approve({
    batchId: prepared.id,
    adminId: admin.id,
    approvalReference: `P21-approval-${runId}`,
    backupEvidenceReference: `P21-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_ACTIVE_ADMIN_REQUIRED');
  await prisma.user.update({ where: { id: admin.id }, data: { active: true } });
  await assert.rejects(() => importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'wrong-deployment',
  }), (error) => error.code === 'IMPORT_DEPLOYMENT_MISMATCH');

  const originalExistingCustomerName = existingCustomer.displayName;
  await prisma.customer.update({
    where: { id: existingCustomer.id },
    data: { displayName: `Concurrent identity change ${runId}` },
  });
  await assert.rejects(() => importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_PLAN_DRIFT');
  await prisma.customer.update({
    where: { id: existingCustomer.id },
    data: { displayName: originalExistingCustomerName },
  });

  const protectedRecord = await prisma.sourceRecord.findFirst({ where: { batchId: prepared.id, sourceSystem: 'ZOHO_CRM' } });
  const originalCiphertext = {
    encryptedPayload: Buffer.from(protectedRecord.encryptedPayload),
    payloadIv: Buffer.from(protectedRecord.payloadIv),
    payloadAuthTag: Buffer.from(protectedRecord.payloadAuthTag),
  };
  const damagedTag = Buffer.from(protectedRecord.payloadAuthTag);
  damagedTag[0] ^= 0xff;
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: { payloadAuthTag: damagedTag } });
  await assert.rejects(() => importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_PAYLOAD_AUTHENTICATION_FAILED');
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: originalCiphertext });
  assert.throws(() => decryptPayload({ ...protectedRecord, sourceRowNumber: protectedRecord.sourceRowNumber + 100 }, stagingKey),
    (error) => error.code === 'IMPORT_PAYLOAD_AUTHENTICATION_FAILED');

  const decrypted = decryptPayload({ ...protectedRecord, ...originalCiphertext }, stagingKey);
  const changedRawCells = decrypted.rawCells.map((cell, index) => (index === 0 ? { ...cell, value: 'changed' } : cell));
  const changedRawEncryption = encryptPayload({ ...decrypted, rawCells: changedRawCells }, stagingKey, protectedRecord);
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: changedRawEncryption });
  await assert.rejects(() => importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_ROW_FINGERPRINT_MISMATCH');
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: originalCiphertext });

  const changedPayloadEncryption = encryptPayload({
    ...decrypted,
    payload: { ...decrypted.payload, acres: '9.50' },
  }, stagingKey, protectedRecord);
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: changedPayloadEncryption });
  await assert.rejects(() => importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_PLAN_DRIFT');
  await prisma.sourceRecord.update({ where: { id: protectedRecord.id }, data: originalCiphertext });

  const committed = await importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  assert.equal(committed.status, 'COMPLETED');
  assert.equal(committed.importedRows, 2);
  assert.equal(await prisma.customer.count({ where: { createdByImportBatchId: prepared.id } }), 1);
  const importedCustomers = await prisma.customer.findMany({
    where: { createdByImportBatchId: prepared.id },
    select: {
      id: true,
      preferredLanguage: true,
      languagePreferences: {
        select: { rank: true, proficiency: true, language: { select: { code: true } } },
      },
    },
  });
  ids.customers.push(...importedCustomers.map((item) => item.id));
  assert.equal(importedCustomers[0].preferredLanguage, 'und');
  assert.deepEqual(importedCustomers[0].languagePreferences, [{
    rank: 1,
    proficiency: 'PRIMARY',
    language: { code: 'und' },
  }]);
  const importedCustomerHistory = await prisma.customerHistory.findFirst({
    where: { customerId: importedCustomers[0].id, eventType: 'CREATED' },
  });
  assert.ok(importedCustomerHistory);
  assert.equal(importedCustomerHistory.actorUserId, admin.id);
  assert.equal(await prisma.historicalServiceRecord.count({ where: { sourceRecord: { batchId: prepared.id } } }), 1);
  assert.equal(await prisma.villageVisit.count({ where: { sourceRecord: { batchId: prepared.id } } }), 1);
  assert.equal(await prisma.lead.count(), initialLeadCount);
  assert.equal(await prisma.user.count(), initialUserCount + 2);

  const repeated = await importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  assert.equal(repeated.status, 'COMPLETED');
  assert.equal(await prisma.historicalServiceRecord.count({ where: { sourceRecord: { batchId: prepared.id } } }), 1);
  assert.equal(await prisma.villageVisit.count({ where: { sourceRecord: { batchId: prepared.id } } }), 1);

  const verification = await importer.verify({ batchId: prepared.id });
  assert.equal(verification.ok, true);
  assert.equal(verification.importedRows, 2);
  const googleResult = await prisma.sourceRecord.findFirst({ where: { batchId: prepared.id, sourceSystem: 'GOOGLE_FORMS' } });
  await mutateTerminalSourceEvidenceForTest(googleResult.id, { resultEntityType: 'HistoricalServiceRecord' });
  const mismatchedVerification = await importer.verify({ batchId: prepared.id });
  assert.equal(mismatchedVerification.ok, false);
  assert.equal(mismatchedVerification.sourceOutcomeMismatches, 1);
  await mutateTerminalSourceEvidenceForTest(googleResult.id, { resultEntityType: 'VillageVisit' });
  assert.equal((await importer.verify({ batchId: prepared.id })).ok, true);
  await assert.rejects(() => importer.prepare({
    filePath: workbook,
    actorId: admin.id,
    key: stagingKey,
    resumeBatchId: prepared.id,
    resumeConfirmation: `REPREPARE_IMPORT_${prepared.id}`,
  }), (error) => error.code === 'IMPORT_REPREPARE_NOT_ALLOWED');
  const safeReport = await importer.report({ batchId: prepared.id });
  const reportText = JSON.stringify(safeReport);
  assert.doesNotMatch(reportText, /Synthetic CRM farmer|Synthetic Google farmer|Synthetic Collector|Synthetic Shop|9876543210|9765432110|Phase village/u);
  const storedSafeReport = (await prisma.importBatch.findUnique({
    where: { id: prepared.id },
    select: { safeReport: true },
  }));
  const storedGoogleResult = await prisma.sourceRecord.findUnique({
    where: { id: googleResult.id },
    select: { finalOutcome: true, safeDetails: true },
  });
  await prisma.importBatch.update({
    where: { id: prepared.id },
    data: {
      safeReport: { ...storedSafeReport.safeReport, injectedPhone: '9876543210' },
    },
  });
  await prisma.sourceRecord.update({
    where: { id: googleResult.id },
    data: {
      finalOutcome: '9876543210',
      safeDetails: { ...storedGoogleResult.safeDetails, injectedPhone: '9876543210' },
    },
  });
  assert.doesNotMatch(JSON.stringify(await importer.report({ batchId: prepared.id })), /9876543210/u);
  await prisma.importBatch.update({
    where: { id: prepared.id },
    data: { safeReport: storedSafeReport.safeReport },
  });
  await prisma.sourceRecord.update({
    where: { id: googleResult.id },
    data: { finalOutcome: storedGoogleResult.finalOutcome, safeDetails: storedGoogleResult.safeDetails },
  });
  const auditText = JSON.stringify(await prisma.auditLog.findMany({ where: { entityType: 'ImportBatch', entityId: prepared.id } }));
  assert.doesNotMatch(auditText, /Synthetic CRM farmer|Synthetic Google farmer|Synthetic Collector|Synthetic Shop|9876543210|9765432110|Phase village/u);
});

test('historical reference gaps do not block keepsake import or phone-based customer autofill data', async () => {
  const suffix = '11';
  const importedVillage = `Imported village ${runId}`;
  const importedMandal = `Imported mandal ${runId}`;
  const importedDistrict = `Imported district ${runId}`;
  const workbook = createSyntheticWorkbook('historical-gaps.xlsx', {
    phoneSuffix: suffix,
    cropName: crop.displayName,
    invalidCrop: true,
    zoneName: `Legacy zone ${runId}`,
    villageName: importedVillage,
    mandalName: importedMandal,
    districtName: importedDistrict,
  });
  const existingCustomer = await prisma.customer.create({
    data: {
      displayName: `Synthetic Google farmer ${runId}-${suffix}`,
      phone: `+9197654321${suffix}`,
      state: 'Existing state',
      remarks: 'Existing information must remain unchanged',
    },
  });
  ids.customers.push(existingCustomer.id);

  const prepared = await importer.prepare({ filePath: workbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(prepared.id);
  assert.equal(prepared.status, 'VALIDATED');
  assert.equal(prepared.validRows, 2);
  assert.equal(prepared.reviewRows, 0);
  assert.equal(prepared.safeReport.validationSummary.unknownCropRows, 2);
  assert.equal(prepared.safeReport.validationSummary.invalidLocationRows, 1);

  await importer.approve({
    batchId: prepared.id,
    adminId: admin.id,
    approvalReference: `P21-keepsake-approval-${runId}`,
    backupEvidenceReference: `P21-keepsake-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  });
  const committed = await importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  assert.equal(committed.status, 'COMPLETED');
  assert.equal(committed.importedRows, 2);

  const enriched = await prisma.customer.findUnique({ where: { id: existingCustomer.id } });
  assert.equal(enriched.displayName, existingCustomer.displayName);
  assert.equal(enriched.state, 'Existing state');
  assert.equal(enriched.remarks, 'Existing information must remain unchanged');
  assert.equal(enriched.village, importedVillage);
  assert.equal(enriched.mandal, importedMandal);
  assert.equal(enriched.district, importedDistrict);

  const visit = await prisma.villageVisit.findFirst({
    where: { sourceRecord: { batchId: prepared.id } },
    include: { administrativeLocation: true },
  });
  assert.equal(visit.customerId, existingCustomer.id);
  assert.equal(visit.cropId, null);
  assert.match(visit.rawCropName, /Unknown crop/u);
  assert.match(visit.notes, /UNKNOWN_CROP/u);
  assert.equal(visit.administrativeLocation.village, importedVillage);
  ids.locations.push(visit.administrativeLocation.id);

  const service = await prisma.historicalServiceRecord.findFirst({
    where: { sourceRecord: { batchId: prepared.id } },
  });
  assert.equal(service.cropId, null);
  assert.equal(service.operatingCenterId, null);
  assert.equal(service.legacyZone, `Legacy zone ${runId}`);
  assert.match(service.notes, /UNKNOWN_OPERATING_CENTER/u);
  assert.equal(await prisma.lead.count(), initialLeadCount);
});

test('invalid customer identities are reported and skipped without blocking valid historical rows', async () => {
  const workbook = createSyntheticWorkbook('invalid-identity-skip.xlsx', {
    phoneSuffix: '12',
    cropName: crop.displayName,
    crmPhoneValue: 'not-a-phone',
  });
  const prepared = await importer.prepare({ filePath: workbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(prepared.id);
  assert.equal(prepared.status, 'VALIDATED');
  assert.equal(prepared.validRows, 1);
  assert.equal(prepared.skippedRows, 1);
  assert.equal(prepared.rejectedRows, 0);

  await importer.approve({
    batchId: prepared.id,
    adminId: admin.id,
    approvalReference: `P21-invalid-skip-approval-${runId}`,
    backupEvidenceReference: `P21-invalid-skip-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  });
  const committed = await importer.commit({
    batchId: prepared.id,
    confirmation: `COMMIT_IMPORT_${prepared.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  assert.equal(committed.importedRows, 1);
  assert.equal(committed.skippedRows, 1);
  const skipped = await prisma.sourceRecord.findFirst({
    where: { batchId: prepared.id, sourceSystem: 'ZOHO_CRM' },
  });
  assert.equal(skipped.status, 'SKIPPED');
  assert.equal(skipped.finalOutcome, 'SKIPPED_INVALID_CUSTOMER_IDENTITY');
  assert.equal(skipped.customerId, null);
  assert.equal((await importer.verify({ batchId: prepared.id })).ok, true);
  assert.equal(await prisma.lead.count(), initialLeadCount);
});

test('cross-batch source identity prevents duplicate outcomes and keeps normalized customer links', async () => {
  const firstWorkbook = createSyntheticWorkbook('cross-batch-first.xlsx', {
    phoneSuffix: '50',
    cropName: crop.displayName,
  });
  const concurrentlyPreparedWorkbook = rewriteWorkbookMetadata(
    firstWorkbook,
    'cross-batch-concurrent.xlsx',
    501,
  );
  const first = await importer.prepare({ filePath: firstWorkbook, actorId: admin.id, key: stagingKey });
  const concurrent = await importer.prepare({
    filePath: concurrentlyPreparedWorkbook,
    actorId: admin.id,
    key: stagingKey,
  });
  ids.batches.push(first.id, concurrent.id);
  assert.equal(first.validRows, 2);
  assert.equal(concurrent.validRows, 2);
  for (const batch of [first, concurrent]) {
    await importer.approve({
      batchId: batch.id,
      adminId: admin.id,
      approvalReference: `P21-cross-approval-${batch.id}`,
      backupEvidenceReference: `P21-cross-backup-${batch.id}`,
      expectedDeploymentName: 'phase21-test',
    });
  }

  await importer.commit({
    batchId: first.id,
    confirmation: `COMMIT_IMPORT_${first.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  const firstCustomers = await prisma.customer.findMany({
    where: { createdByImportBatchId: first.id },
    select: {
      id: true,
      phone: true,
      village: true,
      preferredLanguage: true,
      languagePreferences: {
        select: { rank: true, proficiency: true, language: { select: { code: true } } },
      },
    },
  });
  ids.customers.push(...firstCustomers.map((customer) => customer.id));
  assert.equal(firstCustomers.length, 2);
  assert.equal(firstCustomers.every((customer) => customer.preferredLanguage === 'und'), true);
  assert.equal(firstCustomers.every((customer) => customer.languagePreferences.length === 1
    && customer.languagePreferences[0].language.code === 'und'
    && customer.languagePreferences[0].rank === 1
    && customer.languagePreferences[0].proficiency === 'PRIMARY'), true);
  const crmCustomer = firstCustomers.find((customer) => customer.phone === '+919876543250');
  assert.ok(crmCustomer);
  assert.equal(crmCustomer.village, null, 'Zoho city must not be fabricated as a village');

  await assert.rejects(() => importer.commit({
    batchId: concurrent.id,
    confirmation: `COMMIT_IMPORT_${concurrent.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_PLAN_DRIFT');
  const concurrentAfterFailure = await prisma.importBatch.findUnique({ where: { id: concurrent.id } });
  assert.equal(concurrentAfterFailure.status, 'APPROVED');
  const failedAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'ImportBatch', entityId: concurrent.id, action: 'IMPORT_BATCH_COMMIT_FAILED' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(failedAudit);
  assert.deepEqual(failedAudit.afterState, {
    status: 'APPROVED',
    failureCode: 'IMPORT_PLAN_DRIFT',
    errorClass: 'Error',
    retryable: true,
  });
  assert.doesNotMatch(JSON.stringify(failedAudit), /Synthetic|9876543250|9765432150/u);

  const postCommitDuplicateWorkbook = rewriteWorkbookMetadata(
    firstWorkbook,
    'cross-batch-post-commit.xlsx',
    502,
  );
  const duplicate = await importer.prepare({
    filePath: postCommitDuplicateWorkbook,
    actorId: admin.id,
    key: stagingKey,
  });
  ids.batches.push(duplicate.id);
  assert.equal(duplicate.status, 'VALIDATED');
  assert.equal(duplicate.validRows, 0);
  assert.equal(duplicate.skippedRows, 2);
  const duplicatePreparedRecords = await prisma.sourceRecord.findMany({
    where: { batchId: duplicate.id },
    select: { status: true, reasonCode: true, externalRecordId: true, proposedOutcome: true },
  });
  assert.equal(duplicatePreparedRecords.every((record) => record.status === 'VALID'
    && record.reasonCode === 'ALREADY_IMPORTED_SOURCE_RECORD'
    && record.proposedOutcome === 'SKIP_ALREADY_IMPORTED_SOURCE_RECORD'
    && record.externalRecordId === '50'), true);
  await importer.approve({
    batchId: duplicate.id,
    adminId: admin.id,
    approvalReference: `P21-cross-approval-${duplicate.id}`,
    backupEvidenceReference: `P21-cross-backup-${duplicate.id}`,
    expectedDeploymentName: 'phase21-test',
  });
  await importer.commit({
    batchId: duplicate.id,
    confirmation: `COMMIT_IMPORT_${duplicate.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  const originalRecords = await prisma.sourceRecord.findMany({
    where: { batchId: first.id },
    select: { sourceSystem: true, customerId: true, resultEntityType: true, resultEntityId: true },
  });
  const originalBySystem = new Map(originalRecords.map((record) => [record.sourceSystem, record]));
  const duplicateCommittedRecords = await prisma.sourceRecord.findMany({
    where: { batchId: duplicate.id },
    select: {
      sourceSystem: true,
      status: true,
      finalOutcome: true,
      customerId: true,
      resultEntityType: true,
      resultEntityId: true,
    },
  });
  for (const record of duplicateCommittedRecords) {
    const original = originalBySystem.get(record.sourceSystem);
    assert.equal(record.status, 'SKIPPED');
    assert.equal(record.finalOutcome, 'SKIPPED_ALREADY_IMPORTED_SOURCE_RECORD');
    assert.equal(record.customerId, original.customerId);
    assert.equal(record.resultEntityType, original.resultEntityType);
    assert.equal(record.resultEntityId, original.resultEntityId);
  }
  assert.equal((await importer.verify({ batchId: duplicate.id })).ok, true);
  assert.equal(await prisma.historicalServiceRecord.count({ where: { sourceRecord: { batchId: duplicate.id } } }), 0);
  assert.equal(await prisma.villageVisit.count({ where: { sourceRecord: { batchId: duplicate.id } } }), 0);

  const changedIdentityWorkbook = createSyntheticWorkbook('cross-batch-changed.xlsx', {
    phoneSuffix: '51',
    cropName: crop.displayName,
    crmSerial: '50',
    googleSerial: '50',
  });
  const changedIdentity = await importer.prepare({
    filePath: changedIdentityWorkbook,
    actorId: admin.id,
    key: stagingKey,
  });
  ids.batches.push(changedIdentity.id);
  assert.equal(changedIdentity.status, 'REVIEW_REQUIRED');
  assert.equal(changedIdentity.reviewRows, 2);
  const conflictRecords = await prisma.sourceRecord.findMany({
    where: { batchId: changedIdentity.id },
    select: { status: true, reasonCode: true, safeDetails: true },
  });
  assert.equal(conflictRecords.every((record) => record.status === 'REVIEW_REQUIRED'
    && record.safeDetails.reasonCodes.includes('SOURCE_WORKBOOK_ROW_ID_PHONE_CONFLICT')), true);
  assert.doesNotMatch(JSON.stringify(await importer.report({ batchId: changedIdentity.id })), /Synthetic|9876543251|9765432151/u);
  await importer.abort({
    batchId: changedIdentity.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${changedIdentity.id}`,
  });

  const noIdWorkbook = createSyntheticWorkbook('cross-batch-no-id.xlsx', {
    phoneSuffix: '60',
    cropName: crop.displayName,
    crmSerial: '',
    googleSerial: '',
  });
  const noIdFirst = await importer.prepare({ filePath: noIdWorkbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(noIdFirst.id);
  await importer.approve({
    batchId: noIdFirst.id,
    adminId: admin.id,
    approvalReference: `P21-cross-approval-${noIdFirst.id}`,
    backupEvidenceReference: `P21-cross-backup-${noIdFirst.id}`,
    expectedDeploymentName: 'phase21-test',
  });
  await importer.commit({
    batchId: noIdFirst.id,
    confirmation: `COMMIT_IMPORT_${noIdFirst.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  });
  const noIdCustomers = await prisma.customer.findMany({
    where: { createdByImportBatchId: noIdFirst.id },
    select: { id: true },
  });
  ids.customers.push(...noIdCustomers.map((customer) => customer.id));
  const noIdDuplicateWorkbook = rewriteWorkbookMetadata(noIdWorkbook, 'cross-batch-no-id-copy.xlsx', 601);
  const noIdDuplicate = await importer.prepare({
    filePath: noIdDuplicateWorkbook,
    actorId: admin.id,
    key: stagingKey,
  });
  ids.batches.push(noIdDuplicate.id);
  assert.equal(noIdDuplicate.validRows, 0);
  assert.equal(noIdDuplicate.skippedRows, 2);
  const noIdDuplicateRecords = await prisma.sourceRecord.findMany({
    where: { batchId: noIdDuplicate.id },
    select: { externalRecordId: true, status: true, proposedOutcome: true },
  });
  assert.equal(noIdDuplicateRecords.every((record) => record.externalRecordId === null
    && record.status === 'VALID'
    && record.proposedOutcome === 'SKIP_ALREADY_IMPORTED_SOURCE_RECORD'), true);
  await importer.abort({
    batchId: noIdDuplicate.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${noIdDuplicate.id}`,
  });
});

test('historical gaps remain visible while identity and reference drift fail closed', async () => {
  const ambiguousWorkbook = createSyntheticWorkbook('ambiguous-date.xlsx', {
    phoneSuffix: '40',
    cropName: crop.displayName,
    visitTimestamp: '07/08/2026 10:15:00 AM',
  });
  const ambiguousBatch = await importer.prepare({ filePath: ambiguousWorkbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(ambiguousBatch.id);
  assert.equal(ambiguousBatch.status, 'VALIDATED');
  const ambiguousRecord = await prisma.sourceRecord.findFirst({
    where: { batchId: ambiguousBatch.id, sourceSystem: 'GOOGLE_FORMS' },
    select: { status: true, reasonCode: true, safeDetails: true },
  });
  assert.equal(ambiguousRecord.status, 'VALID');
  assert.equal(ambiguousRecord.reasonCode, null);
  assert.equal(ambiguousRecord.safeDetails.reasonCodes.includes('AMBIGUOUS_VISIT_TIMESTAMP'), true);
  await importer.abort({
    batchId: ambiguousBatch.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${ambiguousBatch.id}`,
  });

  const unknownWorkbook = createSyntheticWorkbook('unknown-crop.xlsx', { phoneSuffix: '20', cropName: crop.displayName, invalidCrop: true });
  const needsReview = await importer.prepare({ filePath: unknownWorkbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(needsReview.id);
  assert.equal(needsReview.status, 'VALIDATED');
  assert.equal(needsReview.validRows, 2);
  assert.equal(needsReview.reviewRows, 0);
  assert.equal(needsReview.safeReport.validationSummary.unknownCropRows, 2);
  await importer.abort({
    batchId: needsReview.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${needsReview.id}`,
  });
  const priorEvidence = immutableSourceEvidence(await prisma.sourceRecord.findMany({
    where: { batchId: needsReview.id },
    orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
  }));
  await assert.rejects(() => importer.prepare({
    filePath: unknownWorkbook,
    actorId: admin.id,
    key: stagingKey,
  }), (error) => error.code === 'IMPORT_WORKBOOK_ALREADY_STAGED');
  const reprepared = await importer.prepare({
    filePath: unknownWorkbook,
    actorId: admin.id,
    key: stagingKey,
    resumeBatchId: needsReview.id,
    resumeConfirmation: `REPREPARE_IMPORT_${needsReview.id}`,
  });
  ids.batches.push(reprepared.id);
  assert.notEqual(reprepared.id, needsReview.id);
  assert.equal(reprepared.attemptNumber, 2);
  assert.equal(reprepared.supersedesBatchId, needsReview.id);
  assert.equal(reprepared.status, 'VALIDATED');
  const priorAfterReprepare = await prisma.importBatch.findUnique({ where: { id: needsReview.id } });
  assert.equal(priorAfterReprepare.status, 'SUPERSEDED');
  assert.equal(priorAfterReprepare.attemptNumber, 1);
  await assert.rejects(() => importer.abort({
    batchId: needsReview.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${needsReview.id}`,
  }), (error) => error.code === 'IMPORT_ABORT_NOT_ALLOWED');
  assert.deepEqual(immutableSourceEvidence(await prisma.sourceRecord.findMany({
    where: { batchId: needsReview.id },
    orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
  })), priorEvidence);
  assert.equal((await importer.verify({ batchId: needsReview.id })).ok, true);
  const successorRecords = await prisma.sourceRecord.findMany({
    where: { batchId: reprepared.id },
    orderBy: [{ sheetName: 'asc' }, { sourceRowNumber: 'asc' }],
  });
  assert.equal(successorRecords.length, priorEvidence.length);
  assert.equal(successorRecords.every((record) => !priorEvidence.some((prior) => prior.id === record.id)), true);
  assert.doesNotThrow(() => decryptPayload(successorRecords[0], stagingKey));
  assert.throws(
    () => decryptPayload({ ...successorRecords[0], batchId: needsReview.id }, stagingKey),
    (error) => error.code === 'IMPORT_PAYLOAD_AUTHENTICATION_FAILED',
  );
  const supersessionAudits = await prisma.auditLog.findMany({
    where: {
      entityType: 'ImportBatch',
      entityId: { in: [needsReview.id, reprepared.id] },
      action: { in: ['IMPORT_BATCH_SUPERSEDED', 'IMPORT_BATCH_PREPARED_AS_NEW_ATTEMPT'] },
    },
  });
  assert.equal(supersessionAudits.length, 2);
  const supersessionAuditText = JSON.stringify(supersessionAudits);
  assert.match(supersessionAuditText, new RegExp(needsReview.id, 'u'));
  assert.match(supersessionAuditText, new RegExp(reprepared.id, 'u'));
  await assert.rejects(() => importer.prepare({
    filePath: unknownWorkbook,
    actorId: admin.id,
    key: stagingKey,
    resumeBatchId: needsReview.id,
    resumeConfirmation: `REPREPARE_IMPORT_${needsReview.id}`,
  }), (error) => error.code === 'IMPORT_WORKBOOK_ALREADY_STAGED' && error.message.includes(reprepared.id));
  await importer.abort({
    batchId: reprepared.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${reprepared.id}`,
  });

  const driftWorkbook = createSyntheticWorkbook('reference-drift.xlsx', { phoneSuffix: '30', cropName: crop.displayName });
  const driftBatch = await importer.prepare({ filePath: driftWorkbook, actorId: admin.id, key: stagingKey });
  ids.batches.push(driftBatch.id);
  await prisma.user.update({ where: { id: admin.id }, data: { active: false } });
  await assert.rejects(() => importer.approve({
    batchId: driftBatch.id,
    adminId: admin.id,
    approvalReference: `P21-inactive-approval-${runId}`,
    backupEvidenceReference: `P21-inactive-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_ACTIVE_ADMIN_REQUIRED');
  await prisma.user.update({ where: { id: admin.id }, data: { active: true } });
  const beforeApprovalDisplayName = crop.displayName;
  await prisma.crop.update({ where: { id: crop.id }, data: { displayName: `${beforeApprovalDisplayName} approval drift`.slice(0, 120) } });
  await assert.rejects(() => importer.approve({
    batchId: driftBatch.id,
    adminId: admin.id,
    approvalReference: `P21-drift-approval-${runId}`,
    backupEvidenceReference: `P21-drift-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_REFERENCE_DATA_DRIFT');
  await prisma.crop.update({ where: { id: crop.id }, data: { displayName: beforeApprovalDisplayName } });
  await importer.approve({
    batchId: driftBatch.id,
    adminId: admin.id,
    approvalReference: `P21-drift-approval-${runId}`,
    backupEvidenceReference: `P21-drift-backup-${runId}`,
    expectedDeploymentName: 'phase21-test',
  });
  const originalDisplayName = crop.displayName;
  await prisma.crop.update({ where: { id: crop.id }, data: { displayName: `${originalDisplayName} revised`.slice(0, 120) } });
  await assert.rejects(() => importer.commit({
    batchId: driftBatch.id,
    confirmation: `COMMIT_IMPORT_${driftBatch.id}`,
    key: stagingKey,
    deploymentName: 'phase21-test',
  }), (error) => error.code === 'IMPORT_REFERENCE_DATA_DRIFT');
  assert.equal(await prisma.customer.count({ where: { createdByImportBatchId: driftBatch.id } }), 0);
  await prisma.crop.update({ where: { id: crop.id }, data: { displayName: originalDisplayName } });
  await importer.abort({
    batchId: driftBatch.id,
    actorId: admin.id,
    confirmation: `ABORT_IMPORT_${driftBatch.id}`,
  });

  await prisma.sourceRecord.updateMany({
    where: { batchId: { in: ids.batches } },
    data: { payloadExpiresAt: new Date(Date.now() - 60_000) },
  });
  await assert.rejects(() => importer.purge({
    batchId: driftBatch.id,
    actorId: admin.id,
    confirmation: 'PURGE_IMPORT_wrong',
  }), (error) => error.code === 'IMPORT_PURGE_CONFIRMATION_INVALID');
  await prisma.user.update({ where: { id: collector.id }, data: { active: false } });
  await assert.rejects(() => importer.purge({
    batchId: driftBatch.id,
    actorId: collector.id,
    confirmation: `PURGE_IMPORT_${driftBatch.id}`,
  }), (error) => error.code === 'IMPORT_ACTIVE_OPERATOR_REQUIRED');
  await prisma.user.update({ where: { id: collector.id }, data: { active: true } });
  await assert.rejects(() => importer.purge({
    batchId: driftBatch.id,
    actorId: collector.id,
    confirmation: `PURGE_IMPORT_${driftBatch.id}`,
  }), (error) => error.code === 'IMPORT_BATCH_OPERATOR_FORBIDDEN');
  let purgedRecords = 0;
  for (const batchId of ids.batches) {
    const purge = await importer.purge({
      batchId,
      actorId: admin.id,
      confirmation: `PURGE_IMPORT_${batchId}`,
    });
    purgedRecords += purge.purgedRecords;
  }
  assert.ok(purgedRecords >= 6);
  const remainingPayloads = await prisma.sourceRecord.findMany({
    where: { batchId: { in: ids.batches } },
    select: {
      encryptedPayload: true,
      payloadIv: true,
      payloadAuthTag: true,
      phoneFingerprint: true,
      recipientLast4: true,
    },
  });
  assert.equal(remainingPayloads.every((record) => record.encryptedPayload.length === 0
    && record.payloadIv.length === 0
    && record.payloadAuthTag.length === 0
    && record.phoneFingerprint === null
    && record.recipientLast4 === null), true);
});

test.after(async () => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.auditLog.deleteMany({ where: { entityType: 'ImportBatch', entityId: { in: ids.batches } } });
    await transaction.historicalServiceRecord.deleteMany({ where: { sourceRecord: { batchId: { in: ids.batches } } } });
    await transaction.villageVisit.deleteMany({ where: { sourceRecord: { batchId: { in: ids.batches } } } });
    await transaction.sourceRecord.deleteMany({ where: { batchId: { in: ids.batches } } });
    await transaction.customer.deleteMany({ where: { createdByImportBatchId: { in: ids.batches } } });
    await transaction.customer.deleteMany({ where: { id: { in: ids.customers } } });
    await transaction.importBatch.deleteMany({ where: { id: { in: ids.batches } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
    await transaction.location.deleteMany({ where: { id: { in: ids.locations } } });
    await transaction.crop.deleteMany({ where: { id: { in: ids.crops } } });
  });
  await prisma.$disconnect();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});
