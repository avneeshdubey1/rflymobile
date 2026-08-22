#!/usr/bin/env node
const service = require('../services/clientMasterImportService');
const repository = require('../src/repositories/clientMasterImportRepository');

function parseArguments(tokens) {
  const [command, ...rest] = tokens;
  if (!['preflight', 'plan', 'commit'].includes(command)) throw new Error('Use one of: preflight, plan, commit');
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index]; const value = rest[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--') || Object.hasOwn(options, name.slice(2))) throw new Error('Every option must use a unique --name value pair');
    options[name.slice(2)] = value;
  }
  return { command, options };
}

async function main() {
  try {
    const { command, options } = parseArguments(process.argv.slice(2));
    const result = command === 'preflight' ? await service.preflight({ filePath: options.file })
      : command === 'plan' ? await service.plan({ filePath: options.file, actorId: options.actor, centerId: options.center })
        : await service.commit({ filePath: options.file, actorId: options.actor, centerId: options.center, expectedPlanHash: options['plan-hash'], expectedDeployment: options.deployment, confirmation: options.confirm, backupReference: options['backup-ref'] });
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } catch (failure) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: failure.code || 'MASTER_IMPORT_FAILED', message: failure.message || 'Client master import failed' })}\n`);
    process.exitCode = 1;
  } finally { await repository.disconnect().catch(() => {}); }
}
if (require.main === module) main();
module.exports = { parseArguments };
