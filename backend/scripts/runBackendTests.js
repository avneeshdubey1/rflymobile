const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = path.resolve(__dirname, '..');
const databaseName = 'rfly_daas_backend_test';
const containerName = process.env.POSTGRES_CONTAINER || 'rfly-postgres';

function parseEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: backendDir, encoding: 'utf8', windowsHide: true, ...options });
  if (result.status !== 0) {
    if (options.stdio !== 'inherit') process.stderr.write(result.stderr || result.stdout || 'Command failed\n');
    process.exit(result.status || 1);
  }
  return (result.stdout || '').trim();
}

const localEnv = parseEnvFile(path.join(backendDir, '.env'));
const sourceDatabaseUrl = process.env.DATABASE_URL || localEnv.DATABASE_URL;
if (!sourceDatabaseUrl) throw new Error('DATABASE_URL is required in backend/.env or the process environment');
const databaseUrl = new URL(sourceDatabaseUrl);
databaseUrl.pathname = `/${databaseName}`;

const exists = run('docker', ['exec', containerName, 'psql', '-U', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${databaseName}'`]);
if (exists.trim() !== '1') run('docker', ['exec', containerName, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]);

const testEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  DEMO_USER_PASSWORD: crypto.randomBytes(24).toString('base64url'),
  NODE_ENV: 'test',
};
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
run(process.execPath, [prismaCli, 'migrate', 'deploy'], { env: testEnv });
run(process.execPath, ['prisma/seed.js'], { env: testEnv });

const testFiles = fs.readdirSync(path.join(backendDir, 'tests'))
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => path.join('tests', file));
run(process.execPath, ['--test', '--test-concurrency=1', '--test-force-exit', ...testFiles], { env: testEnv, stdio: 'inherit' });
