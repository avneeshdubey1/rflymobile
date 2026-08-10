const parser = require('../importer/droneClientExport');
const repository = require('../src/repositories/droneImportRepository');

function importError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function required(value, code, label, maximum = 160) {
  const text = String(value || '').trim();
  if (!text || text.length > maximum) throw importError(code, `${label} is required and must be at most ${maximum} characters`);
  return text;
}

function safePreflight(result) {
  return {
    accepted: true,
    mappingVersion: result.mappingVersion,
    fileSizeBytes: result.fileSizeBytes,
    fileChecksum: result.fileChecksum,
    sourceRows: result.sourceRows,
    canonicalAssets: result.canonicalAssets,
    supersededRows: result.supersededRows,
    superseded: result.superseded,
  };
}

async function preflight({ filePath }) {
  return safePreflight(await parser.preflight(required(filePath, 'DRONE_IMPORT_FILE_REQUIRED', 'Drone export file', 500)));
}

async function plan({ filePath, actorId, centerId }) {
  const parsed = await parser.preflight(required(filePath, 'DRONE_IMPORT_FILE_REQUIRED', 'Drone export file', 500));
  const result = await repository.plan({
    actorId: required(actorId, 'DRONE_IMPORT_ACTOR_REQUIRED', 'Admin actor ID'),
    centerId: required(centerId, 'DRONE_IMPORT_CENTER_REQUIRED', 'Operating centre ID'),
    assets: parsed.assets,
    fileChecksum: parsed.fileChecksum,
    mappingVersion: parsed.mappingVersion,
  });
  return { ...safePreflight(parsed), ...result };
}

async function commit({ filePath, actorId, centerId, expectedPlanHash, expectedDeployment, confirmation, backupReference }) {
  if (confirmation !== 'IMPORT_DRONES') throw importError('DRONE_IMPORT_CONFIRMATION_REQUIRED', 'Use the exact confirmation IMPORT_DRONES');
  const deployment = required(expectedDeployment, 'DRONE_IMPORT_DEPLOYMENT_REQUIRED', 'Expected deployment');
  if (!process.env.DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME !== deployment) {
    throw importError('DRONE_IMPORT_DEPLOYMENT_MISMATCH', 'The current deployment does not match the approved target');
  }
  const planHash = required(expectedPlanHash, 'DRONE_IMPORT_PLAN_REQUIRED', 'Reviewed plan hash', 64);
  if (!/^[0-9a-f]{64}$/u.test(planHash)) throw importError('DRONE_IMPORT_PLAN_INVALID', 'The reviewed plan hash is invalid');
  const parsed = await parser.preflight(required(filePath, 'DRONE_IMPORT_FILE_REQUIRED', 'Drone export file', 500));
  return repository.commit({
    actorId: required(actorId, 'DRONE_IMPORT_ACTOR_REQUIRED', 'Admin actor ID'),
    centerId: required(centerId, 'DRONE_IMPORT_CENTER_REQUIRED', 'Operating centre ID'),
    assets: parsed.assets,
    fileChecksum: parsed.fileChecksum,
    mappingVersion: parsed.mappingVersion,
    expectedPlanHash: planHash,
    backupReference: required(backupReference, 'DRONE_IMPORT_BACKUP_REQUIRED', 'Backup evidence reference'),
  });
}

module.exports = { commit, plan, preflight };
