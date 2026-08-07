const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const { unzipSync } = require('fflate');
const readExcelFileModule = require('read-excel-file/node');

const {
  MAPPING_VERSION,
  SHEETS,
  normalizeHeader,
  normalizeText,
} = require('./farmerDataV1');

const readExcelFile = readExcelFileModule.default || readExcelFileModule;

const WORKBOOK_TYPE = 'XLSX';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_SINGLE_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2048;
const MAX_ENTRY_NAME_BYTES = 1024;
const MAX_DATA_ROWS_PER_SHEET = 5000;
const MAX_WORKSHEET_COLUMN = 64;
const MAX_COMPRESSION_RATIO = 500;

const PREFLIGHT_LIMITS = Object.freeze({
  maximumFileBytes: MAX_FILE_BYTES,
  maximumUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
  maximumSingleEntryBytes: MAX_SINGLE_ENTRY_BYTES,
  maximumZipEntries: MAX_ZIP_ENTRIES,
  maximumEntryNameBytes: MAX_ENTRY_NAME_BYTES,
  maximumDataRowsPerSheet: MAX_DATA_ROWS_PER_SHEET,
  maximumWorksheetColumn: MAX_WORKSHEET_COLUMN,
  maximumCompressionRatio: MAX_COMPRESSION_RATIO,
});

const REQUIRED_PACKAGE_ENTRIES = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
]);

const FORBIDDEN_ENTRY_PATTERNS = Object.freeze([
  /(?:^|\/)vbaproject\.bin$/iu,
  /^xl\/externalLinks(?:\/|$)/iu,
  /^xl\/embeddings(?:\/|$)/iu,
  /^xl\/activeX(?:\/|$)/iu,
  /^customUI(?:\/|$)/iu,
  /^xl\/(?:chartsheets|dialogsheets|macrosheets)(?:\/|$)/iu,
  /^xl\/connections\.xml$/iu,
  /^xl\/queryTables(?:\/|$)/iu,
  /^xl\/calcChain\.xml$/iu,
]);

class WorkbookPreflightError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkbookPreflightError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkbookPreflightError(code, message);
}

function readUInt16(bytes, offset) {
  if (offset < 0 || offset + 2 > bytes.length) fail('INVALID_ZIP', 'The workbook archive is invalid.');
  return bytes.readUInt16LE(offset);
}

function readUInt32(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) fail('INVALID_ZIP', 'The workbook archive is invalid.');
  return bytes.readUInt32LE(offset);
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (readUInt32(bytes, offset) !== 0x06054b50) continue;
    const commentLength = readUInt16(bytes, offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  fail('INVALID_ZIP', 'The workbook archive is invalid.');
}

function decodeEntryName(nameBytes, utf8) {
  let name;
  try {
    name = nameBytes.toString(utf8 ? 'utf8' : 'latin1');
  } catch (_error) {
    fail('INVALID_ZIP_ENTRY_NAME', 'The workbook archive contains an invalid entry name.');
  }
  if (!name || name.includes('\u0000') || name.includes('\uFFFD')) {
    fail('INVALID_ZIP_ENTRY_NAME', 'The workbook archive contains an invalid entry name.');
  }
  return name;
}

function validateEntryPath(name) {
  if (
    name.startsWith('/')
    || name.startsWith('\\')
    || name.includes('\\')
    || /^[A-Za-z]:/u.test(name)
    || /[\u0000-\u001F\u007F]/u.test(name)
  ) {
    fail('UNSAFE_ZIP_PATH', 'The workbook archive contains an unsafe entry path.');
  }

  const segments = name.split('/');
  if (segments.some((segment, index) => (
    segment === '.'
    || segment === '..'
    || ['__proto__', 'prototype', 'constructor'].includes(segment.toLocaleLowerCase('en-US'))
    || (segment === '' && index !== segments.length - 1)
  ))) {
    fail('UNSAFE_ZIP_PATH', 'The workbook archive contains an unsafe entry path.');
  }
}

function isUnixSymlink(versionMadeBy, externalAttributes) {
  const creatorSystem = versionMadeBy >>> 8;
  if (creatorSystem !== 3 && creatorSystem !== 19) return false;
  const mode = externalAttributes >>> 16;
  return (mode & 0o170000) === 0o120000;
}

function analyzeZip(bytes) {
  if (bytes.length < 22) fail('INVALID_ZIP', 'The workbook archive is invalid.');

  const eocdOffset = findEndOfCentralDirectory(bytes);
  const diskNumber = readUInt16(bytes, eocdOffset + 4);
  const centralDirectoryDisk = readUInt16(bytes, eocdOffset + 6);
  const entriesOnDisk = readUInt16(bytes, eocdOffset + 8);
  const entryCount = readUInt16(bytes, eocdOffset + 10);
  const centralDirectorySize = readUInt32(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(bytes, eocdOffset + 16);

  if (
    diskNumber !== 0
    || centralDirectoryDisk !== 0
    || entriesOnDisk !== entryCount
    || entryCount === 0xffff
    || centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
  ) {
    fail('UNSUPPORTED_ZIP_LAYOUT', 'The workbook archive layout is not supported.');
  }
  if (entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) {
    fail('SUSPICIOUS_ZIP', 'The workbook archive contains an unsafe number of entries.');
  }
  if (centralDirectoryOffset + centralDirectorySize !== eocdOffset) {
    fail('SUSPICIOUS_ZIP', 'The workbook archive has an unexpected layout.');
  }

  const entries = [];
  const names = new Set();
  const caseFoldedNames = new Set();
  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  let totalCompressedBytes = 0;
  let minimumLocalHeaderOffset = Number.MAX_SAFE_INTEGER;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(bytes, offset) !== 0x02014b50) {
      fail('INVALID_ZIP', 'The workbook archive central directory is invalid.');
    }

    const versionMadeBy = readUInt16(bytes, offset + 4);
    const flags = readUInt16(bytes, offset + 8);
    const compressionMethod = readUInt16(bytes, offset + 10);
    const crc32 = readUInt32(bytes, offset + 16);
    const compressedSize = readUInt32(bytes, offset + 20);
    const uncompressedSize = readUInt32(bytes, offset + 24);
    const nameLength = readUInt16(bytes, offset + 28);
    const extraLength = readUInt16(bytes, offset + 30);
    const commentLength = readUInt16(bytes, offset + 32);
    const diskStart = readUInt16(bytes, offset + 34);
    const externalAttributes = readUInt32(bytes, offset + 38);
    const localHeaderOffset = readUInt32(bytes, offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;

    if (entryEnd > eocdOffset || nameLength === 0 || nameLength > MAX_ENTRY_NAME_BYTES) {
      fail('INVALID_ZIP', 'The workbook archive contains an invalid entry.');
    }
    if (diskStart !== 0 || localHeaderOffset === 0xffffffff || uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
      fail('UNSUPPORTED_ZIP_LAYOUT', 'The workbook archive layout is not supported.');
    }
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) {
      fail('ENCRYPTED_ZIP_ENTRY', 'Encrypted workbook archive entries are not supported.');
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      fail('UNSUPPORTED_ZIP_COMPRESSION', 'The workbook archive uses unsupported compression.');
    }
    if (uncompressedSize > MAX_SINGLE_ENTRY_BYTES) {
      fail('SUSPICIOUS_ZIP', 'The workbook archive contains an oversized entry.');
    }
    if (
      uncompressedSize > 1024 * 1024
      && (compressedSize === 0 || uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO)
    ) {
      fail('SUSPICIOUS_ZIP', 'The workbook archive has an unsafe compression ratio.');
    }
    if (isUnixSymlink(versionMadeBy, externalAttributes)) {
      fail('ZIP_SYMLINK', 'Workbook archive links are not supported.');
    }

    const name = decodeEntryName(bytes.subarray(offset + 46, offset + 46 + nameLength), (flags & 0x0800) !== 0);
    validateEntryPath(name);
    const foldedName = name.toLocaleLowerCase('en-US');
    if (names.has(name) || caseFoldedNames.has(foldedName)) {
      fail('DUPLICATE_ZIP_ENTRY', 'The workbook archive contains duplicate entries.');
    }
    names.add(name);
    caseFoldedNames.add(foldedName);

    if (FORBIDDEN_ENTRY_PATTERNS.some((pattern) => pattern.test(name))) {
      fail('ACTIVE_WORKBOOK_CONTENT', 'The workbook contains unsupported active or external content.');
    }

    totalUncompressedBytes += uncompressedSize;
    totalCompressedBytes += compressedSize;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      fail('SUSPICIOUS_ZIP', 'The expanded workbook exceeds the safety limit.');
    }
    minimumLocalHeaderOffset = Math.min(minimumLocalHeaderOffset, localHeaderOffset);

    entries.push({
      name,
      flags,
      compressionMethod,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = entryEnd;
  }

  if (offset !== eocdOffset || minimumLocalHeaderOffset !== 0) {
    fail('SUSPICIOUS_ZIP', 'The workbook archive has an unexpected layout.');
  }
  if (
    totalUncompressedBytes > 1024 * 1024
    && (totalCompressedBytes === 0 || totalUncompressedBytes / totalCompressedBytes > MAX_COMPRESSION_RATIO)
  ) {
    fail('SUSPICIOUS_ZIP', 'The workbook archive has an unsafe compression ratio.');
  }

  for (const entry of entries) {
    const localOffset = entry.localHeaderOffset;
    if (localOffset + 30 > centralDirectoryOffset || readUInt32(bytes, localOffset) !== 0x04034b50) {
      fail('INVALID_ZIP', 'The workbook archive contains an invalid local entry.');
    }
    const localFlags = readUInt16(bytes, localOffset + 6);
    const localCompressionMethod = readUInt16(bytes, localOffset + 8);
    const localCrc32 = readUInt32(bytes, localOffset + 14);
    const localCompressedSize = readUInt32(bytes, localOffset + 18);
    const localUncompressedSize = readUInt32(bytes, localOffset + 22);
    const localNameLength = readUInt16(bytes, localOffset + 26);
    const localExtraLength = readUInt16(bytes, localOffset + 28);
    const localDataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (
      localNameLength === 0
      || localNameLength > MAX_ENTRY_NAME_BYTES
      || localDataOffset > centralDirectoryOffset
      || localDataOffset + entry.compressedSize > centralDirectoryOffset
    ) {
      fail('INVALID_ZIP', 'The workbook archive contains an invalid local entry.');
    }
    if (localFlags !== entry.flags || localCompressionMethod !== entry.compressionMethod) {
      fail('INVALID_ZIP', 'The workbook archive local entry does not match its directory record.');
    }
    const usesDataDescriptor = (entry.flags & 0x0008) !== 0;
    if (!usesDataDescriptor && (
      localCrc32 !== entry.crc32
      || localCompressedSize !== entry.compressedSize
      || localUncompressedSize !== entry.uncompressedSize
    )) {
      fail('INVALID_ZIP', 'The workbook archive local entry sizes do not match its directory record.');
    }
    const localName = decodeEntryName(
      bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      (localFlags & 0x0800) !== 0,
    );
    if (localName !== entry.name) {
      fail('INVALID_ZIP', 'The workbook archive local entry does not match its directory record.');
    }
  }

  return {
    entries,
    entryCount,
    totalCompressedBytes,
    totalUncompressedBytes,
  };
}

function columnNumber(columnLetters) {
  let result = 0;
  for (const character of columnLetters.toUpperCase()) {
    result = (result * 26) + character.charCodeAt(0) - 64;
  }
  return result;
}

function inspectXmlContent(name, data) {
  const xmlBytes = Buffer.from(data);
  const xml = xmlBytes.toString('utf8');
  const hasUtf16Bom = (xmlBytes[0] === 0xff && xmlBytes[1] === 0xfe)
    || (xmlBytes[0] === 0xfe && xmlBytes[1] === 0xff);
  if (hasUtf16Bom
    || xml.includes('\u0000')
    || /<\?xml\b[^>]*\bencoding\s*=\s*["'](?!utf-?8["'])[^"']+["']/iu.test(xml)) {
    fail('UNSUPPORTED_XML_ENCODING', 'The workbook contains an unsupported XML encoding.');
  }
  if (/<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b/iu.test(xml)) {
    fail('UNSAFE_XML', 'The workbook contains unsupported XML declarations.');
  }
  if (/<(?:[A-Za-z_][\w.-]*:)?f(?:\s|>|\/)/iu.test(xml)) {
    fail('FORMULA_NOT_ALLOWED', 'Workbook formulas are not allowed.');
  }
  const relationshipPattern = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)\/?\s*>/giu;
  for (const relationship of xml.matchAll(relationshipPattern)) {
    const attributes = relationship[1];
    if (!/\bTargetMode\s*=\s*["']External["']/iu.test(attributes)) continue;
    const type = attributes.match(/\bType\s*=\s*["']([^"']+)["']/iu)?.[1] || '';
    const target = attributes.match(/\bTarget\s*=\s*["']([^"']+)["']/iu)?.[1] || '';
    const isPassiveWebHyperlink = /\/hyperlink$/iu.test(type) && /^https?:\/\//iu.test(target);
    if (!isPassiveWebHyperlink) {
      fail('EXTERNAL_RELATIONSHIP', 'The workbook contains an unsupported external relationship.');
    }
  }
  if (
    name.toLocaleLowerCase('en-US') === '[content_types].xml'
    && /(?:macroEnabled|vbaProject|activeX|oleObject|externalLink)/iu.test(xml)
  ) {
    fail('ACTIVE_WORKBOOK_CONTENT', 'The workbook contains unsupported active or external content.');
  }

  if (!/^xl\/worksheets\/[^/]+\.xml$/iu.test(name)) return;

  const rowPattern = /<(?:[A-Za-z_][\w.-]*:)?row\b[^>]*\br\s*=\s*["'](\d+)["']/giu;
  for (const match of xml.matchAll(rowPattern)) {
    if (Number(match[1]) > MAX_DATA_ROWS_PER_SHEET + 1) {
      fail('TOO_MANY_SHEET_ROWS', 'A workbook sheet exceeds the row safety limit.');
    }
  }

  const cellPattern = /<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*\br\s*=\s*["']([A-Z]+)(\d+)["']/giu;
  for (const match of xml.matchAll(cellPattern)) {
    if (Number(match[2]) > MAX_DATA_ROWS_PER_SHEET + 1) {
      fail('TOO_MANY_SHEET_ROWS', 'A workbook sheet exceeds the row safety limit.');
    }
    if (columnNumber(match[1]) > MAX_WORKSHEET_COLUMN) {
      fail('SUSPICIOUS_WORKSHEET_DIMENSIONS', 'A workbook sheet exceeds the column safety limit.');
    }
  }

  const dimensionPattern = /<(?:[A-Za-z_][\w.-]*:)?dimension\b[^>]*\bref\s*=\s*["'][^:"']*:([A-Z]+)(\d+)["']/iu;
  const dimension = xml.match(dimensionPattern);
  if (dimension) {
    if (Number(dimension[2]) > MAX_DATA_ROWS_PER_SHEET + 1 || columnNumber(dimension[1]) > MAX_WORKSHEET_COLUMN) {
      fail('SUSPICIOUS_WORKSHEET_DIMENSIONS', 'A workbook sheet has unsafe dimensions.');
    }
  }
}

function unpackAndInspect(bytes, zipMetadata) {
  let unpacked;
  try {
    unpacked = unzipSync(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  } catch (_error) {
    fail('INVALID_ZIP', 'The workbook archive could not be expanded safely.');
  }

  const unpackedNames = Object.keys(unpacked);
  if (unpackedNames.length !== zipMetadata.entries.length) {
    fail('INVALID_ZIP', 'The workbook archive entry list is inconsistent.');
  }

  const metadataByName = new Map(zipMetadata.entries.map((entry) => [entry.name, entry]));
  for (const name of unpackedNames) {
    const metadata = metadataByName.get(name);
    if (!metadata || unpacked[name].byteLength !== metadata.uncompressedSize) {
      fail('INVALID_ZIP', 'The workbook archive entry data is inconsistent.');
    }
    if (/\.(?:xml|rels)$/iu.test(name) || name === '[Content_Types].xml') {
      inspectXmlContent(name, unpacked[name]);
    }
  }

  for (const requiredEntry of REQUIRED_PACKAGE_ENTRIES) {
    if (!Object.prototype.hasOwnProperty.call(unpacked, requiredEntry)) {
      fail('INVALID_XLSX_PACKAGE', 'The workbook package is missing a required component.');
    }
  }

  const worksheetEntries = unpackedNames.filter((name) => /^xl\/worksheets\/[^/]+\.xml$/iu.test(name));
  if (worksheetEntries.length !== Object.keys(SHEETS).length) {
    fail('UNEXPECTED_WORKSHEET_COUNT', 'The workbook must contain exactly the expected worksheets.');
  }

  return unpacked;
}

function logicalCellCount(row) {
  let count = row.length;
  while (count > 0 && normalizeText(row[count - 1]) === null) count -= 1;
  return count;
}

function validateSheet(sheet, definition) {
  const rows = Array.isArray(sheet.data) ? sheet.data : [];
  if (rows.length === 0) fail('MISSING_HEADER_ROW', 'A required workbook sheet has no header row.');
  if (rows.length - 1 > MAX_DATA_ROWS_PER_SHEET) {
    fail('TOO_MANY_SHEET_ROWS', 'A workbook sheet exceeds the row safety limit.');
  }

  const header = rows[0] || [];
  const expectedHeaders = definition.headers;
  if (logicalCellCount(header) !== expectedHeaders.length) {
    fail('HEADER_MISMATCH', 'A workbook sheet does not match the required header layout.');
  }
  for (let index = 0; index < expectedHeaders.length; index += 1) {
    if (normalizeHeader(header[index]) !== normalizeHeader(expectedHeaders[index])) {
      fail('HEADER_MISMATCH', 'A workbook sheet does not match the required header layout.');
    }
  }

  for (const row of rows) {
    if (row.slice(expectedHeaders.length).some((cell) => normalizeText(cell) !== null)) {
      fail('UNEXPECTED_SHEET_COLUMN', 'A workbook sheet contains data outside the required columns.');
    }
  }

  return {
    name: definition.name,
    sourceSystem: definition.sourceSystem,
    rows: rows.map((row) => row.slice(0, expectedHeaders.length)),
    dataRowCount: rows.length - 1,
  };
}

async function preflightWorkbook(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    fail('INVALID_FILE_PATH', 'A workbook file path is required.');
  }
  if (path.extname(filePath).toLocaleLowerCase('en-US') !== '.xlsx') {
    fail('INVALID_FILE_TYPE', 'Only .xlsx workbook files are accepted.');
  }

  let fileStat;
  try {
    fileStat = await fs.lstat(filePath);
  } catch (_error) {
    fail('FILE_UNREADABLE', 'The workbook file is not readable.');
  }
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    fail('INVALID_FILE_TYPE', 'The workbook must be a regular file.');
  }
  if (fileStat.size <= 0 || fileStat.size > MAX_FILE_BYTES) {
    fail('FILE_SIZE_LIMIT', 'The workbook file size is outside the accepted limit.');
  }

  let bytes;
  try {
    bytes = await fs.readFile(filePath);
  } catch (_error) {
    fail('FILE_UNREADABLE', 'The workbook file is not readable.');
  }
  if (bytes.length !== fileStat.size || bytes.length > MAX_FILE_BYTES) {
    fail('FILE_CHANGED_DURING_READ', 'The workbook changed while it was being read.');
  }

  const zipMetadata = analyzeZip(bytes);
  unpackAndInspect(bytes, zipMetadata);

  let parsedSheets;
  try {
    parsedSheets = await readExcelFile(bytes, { trim: true });
  } catch (_error) {
    fail('WORKBOOK_PARSE_FAILED', 'The workbook could not be parsed safely.');
  }
  if (!Array.isArray(parsedSheets) || parsedSheets.length !== Object.keys(SHEETS).length) {
    fail('UNEXPECTED_WORKSHEET_COUNT', 'The workbook must contain exactly the expected worksheets.');
  }

  const parsedNames = parsedSheets.map((sheet) => sheet.sheet);
  if (new Set(parsedNames).size !== parsedNames.length) {
    fail('DUPLICATE_WORKSHEET', 'The workbook contains duplicate worksheet names.');
  }
  const expectedNames = Object.values(SHEETS).map((definition) => definition.name);
  if (
    parsedNames.some((name) => !expectedNames.includes(name))
    || expectedNames.some((name) => !parsedNames.includes(name))
  ) {
    fail('WORKSHEET_NAME_MISMATCH', 'The workbook worksheet names do not match the required layout.');
  }

  const sheets = Object.values(SHEETS).map((definition) => {
    const parsed = parsedSheets.find((sheet) => sheet.sheet === definition.name);
    return validateSheet(parsed, definition);
  });

  const fileChecksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const sheetSummaries = sheets.map((sheet) => ({
    name: sheet.name,
    sourceSystem: sheet.sourceSystem,
    dataRowCount: sheet.dataRowCount,
    columnCount: SHEETS[sheet.sourceSystem === SHEETS.CRM.sourceSystem ? 'CRM' : 'GOOGLE'].headers.length,
  }));

  return {
    filePath: path.resolve(filePath),
    originalFileName: path.basename(filePath),
    workbookType: WORKBOOK_TYPE,
    mappingVersion: MAPPING_VERSION,
    fileSizeBytes: bytes.length,
    fileChecksum,
    sheets,
    safeSummary: {
      accepted: true,
      workbookType: WORKBOOK_TYPE,
      mappingVersion: MAPPING_VERSION,
      fileSizeBytes: bytes.length,
      fileChecksum,
      archiveEntryCount: zipMetadata.entryCount,
      expandedSizeBytes: zipMetadata.totalUncompressedBytes,
      sheets: sheetSummaries,
    },
  };
}

module.exports = {
  MAX_DATA_ROWS_PER_SHEET,
  MAX_FILE_BYTES,
  MAX_SINGLE_ENTRY_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  PREFLIGHT_LIMITS,
  WORKBOOK_TYPE,
  WorkbookPreflightError,
  preflightWorkbook,
};
