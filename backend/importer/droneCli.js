#!/usr/bin/env node

const service = require('../services/droneDataImportService');
const repository = require('../src/repositories/droneImportRepository');

function argumentsOf(tokens) {
  const [command, ...rest] = tokens;
  if (!['preflight', 'plan', 'commit'].includes(command)) throw new Error('Use one of: preflight, plan, commit');
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) throw new Error('Every option must use --name value syntax');
    if (Object.hasOwn(options, name.slice(2))) throw new Error(`Duplicate option ${name}`);
    options[name.slice(2)] = value;
  }
  return { command, options };
}

async function main() {
  try {
    const { command, options } = argumentsOf(process.argv.slice(2));
    let result;
    if (command === 'preflight') result = await service.preflight({ filePath: options.file });
    if (command === 'plan') result = await service.plan({ filePath: options.file, actorId: options.actor, centerId: options.center });
    if (command === 'commit') result = await service.commit({
      filePath: options.file,
      actorId: options.actor,
      centerId: options.center,
      expectedPlanHash: options['plan-hash'],
      expectedDeployment: options.deployment,
      confirmation: options.confirm,
      backupReference: options['backup-ref'],
    });
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  } catch (error) {
    const safeCode = typeof error?.code === 'string' && error.code.startsWith('DRONE_') ? error.code : 'DRONE_IMPORT_FAILED';
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeCode, message: safeCode === 'DRONE_IMPORT_FAILED' ? 'The drone import operation failed' : error.message }, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await repository.disconnect().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { argumentsOf };
