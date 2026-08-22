const parser = require('../importer/clientMasterWorkbookV1');
const repository = require('../src/repositories/clientMasterImportRepository');

function required(value, code, label, maximum = 500) {
  const text = String(value || '').trim();
  if (!text || text.length > maximum) { const error = new Error(`${label} is required`); error.code = code; throw error; }
  return text;
}

async function parse(filePath) {
  return parser.preflight(required(filePath, 'MASTER_IMPORT_FILE_REQUIRED', 'Client master workbook file'));
}
async function preflight({ filePath }) {
  const parsed = await parse(filePath);
  return parsed.safeSummary;
}
async function plan({ filePath, actorId, centerId }) {
  const parsed = await parse(filePath);
  return { ...parsed.safeSummary, ...await repository.plan({ ...parsed, actorId: required(actorId, 'MASTER_IMPORT_ACTOR_REQUIRED', 'Admin actor ID'), centerId: required(centerId, 'MASTER_IMPORT_CENTER_REQUIRED', 'Operating center ID') }) };
}
async function commit({ filePath, actorId, centerId, expectedPlanHash, expectedDeployment, confirmation, backupReference }) {
  if (confirmation !== 'IMPORT_CLIENT_MASTER') { const error = new Error('Use the exact confirmation IMPORT_CLIENT_MASTER'); error.code = 'MASTER_IMPORT_CONFIRMATION_REQUIRED'; throw error; }
  if (!process.env.DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME !== required(expectedDeployment, 'MASTER_IMPORT_DEPLOYMENT_REQUIRED', 'Expected deployment')) { const error = new Error('The current deployment does not match the approved target'); error.code = 'MASTER_IMPORT_DEPLOYMENT_MISMATCH'; throw error; }
  const parsed = await parse(filePath);
  return repository.commit({ ...parsed, actorId: required(actorId, 'MASTER_IMPORT_ACTOR_REQUIRED', 'Admin actor ID'), centerId: required(centerId, 'MASTER_IMPORT_CENTER_REQUIRED', 'Operating center ID'), expectedPlanHash: required(expectedPlanHash, 'MASTER_IMPORT_PLAN_REQUIRED', 'Reviewed plan hash', 64), backupReference: required(backupReference, 'MASTER_IMPORT_BACKUP_REQUIRED', 'Backup evidence reference') });
}
module.exports = { commit, plan, preflight };
