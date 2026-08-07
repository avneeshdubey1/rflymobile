#!/usr/bin/env node

const importRepository = require('../src/repositories/importRepository');
const importer = require('../services/farmerDataImportService');
const { loadKeyFromFile } = require('./stagingCrypto');

const KNOWN_COMMANDS = new Set(['preflight', 'prepare', 'report', 'approve', 'commit', 'verify', 'abort', 'purge']);

function cliError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!KNOWN_COMMANDS.has(command)) {
    throw cliError('IMPORT_COMMAND_INVALID', 'Use one of: preflight, prepare, report, approve, commit, verify, abort, purge');
  }
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--') || token.length < 3) {
      throw cliError('IMPORT_ARGUMENT_INVALID', 'Every command argument must use --name value syntax');
    }
    const name = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw cliError('IMPORT_ARGUMENT_MISSING', `A value is required for --${name}`);
    if (Object.hasOwn(options, name)) throw cliError('IMPORT_ARGUMENT_DUPLICATE', `--${name} may be supplied only once`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function required(options, name) {
  const value = String(options[name] || '').trim();
  if (!value) throw cliError('IMPORT_ARGUMENT_MISSING', `--${name} is required`);
  return value;
}

function stagingKey() {
  return loadKeyFromFile(process.env.IMPORT_STAGING_KEY_FILE);
}

async function execute(command, options) {
  if (command === 'preflight') return importer.preflight({ filePath: required(options, 'file') });
  if (command === 'prepare') {
    if (options['resume-batch'] && options['supersede-batch']) {
      throw cliError('IMPORT_ARGUMENT_CONFLICT', 'Use only --supersede-batch for a new immutable attempt');
    }
    return importer.prepare({
      filePath: required(options, 'file'),
      actorId: required(options, 'actor'),
      key: stagingKey(),
      keyVersion: process.env.IMPORT_STAGING_KEY_VERSION || 'v1',
      retentionDays: options['retention-days'] || 7,
      resumeBatchId: options['supersede-batch'] || options['resume-batch'] || null,
      resumeConfirmation: options.confirm || null,
    });
  }
  if (command === 'report') return importer.report({ batchId: required(options, 'batch') });
  if (command === 'approve') {
    return importer.approve({
      batchId: required(options, 'batch'),
      adminId: required(options, 'admin'),
      approvalReference: required(options, 'approval-ref'),
      backupEvidenceReference: required(options, 'backup-ref'),
      expectedDeploymentName: required(options, 'deployment'),
    });
  }
  if (command === 'commit') {
    return importer.commit({
      batchId: required(options, 'batch'),
      confirmation: required(options, 'confirm'),
      key: stagingKey(),
      deploymentName: options.deployment || process.env.DEPLOYMENT_NAME,
    });
  }
  if (command === 'verify') return importer.verify({ batchId: required(options, 'batch') });
  if (command === 'abort') {
    return importer.abort({
      batchId: required(options, 'batch'),
      actorId: required(options, 'actor'),
      confirmation: required(options, 'confirm'),
    });
  }
  return importer.purge({
    batchId: required(options, 'batch'),
    actorId: required(options, 'actor'),
    confirmation: required(options, 'confirm'),
  });
}

async function main() {
  try {
    const { command, options } = parseArguments(process.argv.slice(2));
    const result = await execute(command, options);
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } catch (error) {
    const known = typeof error?.code === 'string' && (
      error.code.startsWith('IMPORT_')
      || error.code.startsWith('WORKBOOK_')
      || error.name === 'WorkbookPreflightError'
    );
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: known ? error.code : 'IMPORT_OPERATION_FAILED',
      message: known ? error.message : 'The import operation failed without exposing source data',
    })}\n`);
    process.exitCode = 1;
  } finally {
    await importRepository.disconnect().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = {
  execute,
  parseArguments,
};
