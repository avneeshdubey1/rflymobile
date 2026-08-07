const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
const targetMigration = '20260807123000_evolve_master_history_import_schema';
const containerName = process.env.POSTGRES_CONTAINER || 'rfly-postgres';
const requestedDatabase = process.env.MIGRATION_VERIFY_DATABASE || 'rfly_schema_migration_test';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${output ? `:\n${output}` : ''}`);
  }
  return (result.stdout || '').trim();
}

function assertDisposableDatabaseName(databaseName) {
  assert.match(databaseName, /^[a-z][a-z0-9_]{0,62}$/, `Unsafe database name: ${databaseName}`);
  assert.ok(databaseName.endsWith('_test'), `Refusing database without _test suffix: ${databaseName}`);
}

assertDisposableDatabaseName(requestedDatabase);
const databaseStem = requestedDatabase.slice(0, -'_test'.length);
const cleanDatabase = `${databaseStem}_clean_test`;
const legacyDatabase = `${databaseStem}_legacy_test`;
assertDisposableDatabaseName(cleanDatabase);
assertDisposableDatabaseName(legacyDatabase);
assert.notEqual(cleanDatabase, legacyDatabase);

const localEnv = parseEnvFile(path.join(backendDir, '.env'));
const sourceDatabaseUrl = process.env.DATABASE_URL || localEnv.DATABASE_URL;
assert.ok(sourceDatabaseUrl, 'DATABASE_URL is required in backend/.env or the process environment');

function databaseUrl(databaseName) {
  assertDisposableDatabaseName(databaseName);
  const url = new URL(sourceDatabaseUrl);
  url.pathname = `/${databaseName}`;
  url.search = '';
  return url.toString();
}

function psql(databaseName, sql, { tuplesOnly = true } = {}) {
  assertDisposableDatabaseName(databaseName);
  const args = [
    'exec', '-i', containerName,
    'psql', '-X', '-U', 'postgres', '-d', databaseName,
    '-v', 'ON_ERROR_STOP=1',
  ];
  if (tuplesOnly) args.push('-A', '-t');
  return run('docker', args, { input: sql });
}

function adminSql(sql) {
  return run('docker', [
    'exec', '-i', containerName,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-A', '-t',
  ], { input: sql });
}

function recreateDatabase(databaseName) {
  assertDisposableDatabaseName(databaseName);
  adminSql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);\nCREATE DATABASE "${databaseName}";\n`);
}

function dropDatabase(databaseName) {
  assertDisposableDatabaseName(databaseName);
  adminSql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);\n`);
}

function scalar(databaseName, sql) {
  const output = psql(databaseName, sql).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.equal(output.length, 1, `Expected one scalar row, received: ${output.join(' | ')}`);
  return output[0];
}

function migrationNames() {
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort();
}

function applySqlMigration(databaseName, migrationName) {
  const file = path.join(migrationsDir, migrationName, 'migration.sql');
  psql(databaseName, fs.readFileSync(file, 'utf8'), { tuplesOnly: false });
}

function coreCounts(databaseName) {
  return Object.fromEntries([
    'OperatingCenter',
    'User',
    'Customer',
    'Drone',
    'LMV',
    'Lead',
    'Assignment',
  ].map((table) => [table, Number(scalar(databaseName, `SELECT COUNT(*) FROM "${table}";`))]));
}

function assertAllChecksValidated(databaseName) {
  const unvalidated = Number(scalar(databaseName, `
    SELECT COUNT(*)
    FROM pg_constraint
    WHERE contype = 'c'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
      AND NOT convalidated;
  `));
  assert.equal(unvalidated, 0, 'The migration left unvalidated CHECK constraints');
  return Number(scalar(databaseName, `
    SELECT COUNT(*)
    FROM pg_constraint
    WHERE contype = 'c'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
      AND convalidated;
  `));
}

function verifyCleanReplay(migrations) {
  recreateDatabase(cleanDatabase);
  const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl(cleanDatabase) },
  });

  const applied = Number(scalar(cleanDatabase, `
    SELECT COUNT(*) FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  `));
  assert.equal(applied, migrations.length, 'Clean replay did not apply every migration exactly once');
  assert.equal(Number(scalar(cleanDatabase, `
    SELECT COUNT(*) FROM "_prisma_migrations"
    WHERE migration_name = '${targetMigration}'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL;
  `)), 1, 'Target migration was not applied successfully during clean replay');

  return {
    migrationsApplied: applied,
    validatedChecks: assertAllChecksValidated(cleanDatabase),
  };
}

const legacyFixtureSql = `
INSERT INTO "OperatingCenter" ("id", "name", "latitude", "longitude", "radiusKm")
VALUES ('migration-center', 'Migration Test Center', 11.0000, 77.0000, 50);

INSERT INTO "User" (
  "id", "name", "email", "phone", "passwordHash", "role", "homeCenterId"
) VALUES (
  'migration-pilot', 'Legacy Pilot', 'migration-pilot@rfly.test', '+919000000001',
  'not-a-real-password-hash', 'PILOT', 'migration-center'
);

INSERT INTO "Customer" (
  "id", "displayName", "phone", "preferredLanguage", "village", "district", "updatedAt"
) VALUES (
  'migration-customer', 'Legacy Customer', '9876543210', 'ta',
  'Legacy Village', 'Legacy District', CURRENT_TIMESTAMP
);

INSERT INTO "Drone" (
  "id", "model", "serialNumber", "uin", "certified", "homeCenterId"
) VALUES (
  'migration-drone', 'Legacy Model', 'MIGRATION-SERIAL-1', 'MIGRATION-UIN-1', 'yes', 'migration-center'
);

INSERT INTO "Lead" (
  "id", "customerId", "farmerName", "farmerPhone", "farmerAddress", "acreage",
  "cropType", "status", "intakeChannel", "matchedCenterId"
) VALUES (
  'migration-lead', 'migration-customer', 'Legacy Customer', '9876543210',
  'Legacy Village, Legacy District', 2.5, 'Paddy', 'SCHEDULED', 'MANUAL_SALES', 'migration-center'
);

INSERT INTO "Assignment" (
  "id", "leadId", "pilotId", "copilotId", "droneId", "lmvId",
  "scheduledDate", "dailySequence", "expectedAcreage"
) VALUES (
  'migration-assignment', 'migration-lead', 'migration-pilot', NULL,
  'migration-drone', NULL, CURRENT_TIMESTAMP + INTERVAL '1 day', 1, 2.5
);
`;

function verifyPopulatedLegacyUpgrade(migrations) {
  recreateDatabase(legacyDatabase);
  const targetIndex = migrations.indexOf(targetMigration);
  assert.notEqual(targetIndex, -1, `Missing target migration ${targetMigration}`);
  assert.equal(targetIndex, migrations.length - 1, 'Harness requires the target migration to be the latest migration');

  for (const migration of migrations.slice(0, targetIndex)) applySqlMigration(legacyDatabase, migration);
  psql(legacyDatabase, legacyFixtureSql, { tuplesOnly: false });
  const before = coreCounts(legacyDatabase);
  assert.deepEqual(before, {
    OperatingCenter: 1,
    User: 1,
    Customer: 1,
    Drone: 1,
    LMV: 0,
    Lead: 1,
    Assignment: 1,
  });

  applySqlMigration(legacyDatabase, targetMigration);
  const after = coreCounts(legacyDatabase);
  assert.deepEqual(after, before, 'Core business row counts changed during additive migration');

  assert.equal(
    scalar(legacyDatabase, `SELECT "phone" FROM "Customer" WHERE "id" = 'migration-customer';`),
    '+919876543210',
    'Legacy Indian phone was not canonicalized',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "legacyCrewIncomplete"::text FROM "Assignment" WHERE "id" = 'migration-assignment';`),
    'true',
    'Incomplete legacy assignment was not quarantined',
  );

  const validatedChecks = assertAllChecksValidated(legacyDatabase);

  psql(legacyDatabase, `
    UPDATE "Customer"
    SET "displayName" = 'Legacy Customer Updated', "remarks" = 'post-migration write', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'migration-customer';

    UPDATE "Assignment"
    SET "weatherNote" = 'post-migration metadata update'
    WHERE "id" = 'migration-assignment';

    INSERT INTO "Customer" ("id", "displayName", "phone", "preferredLanguage", "updatedAt")
    VALUES ('migration-new-customer', 'New Customer', '+919876543211', 'ta', CURRENT_TIMESTAMP);
  `, { tuplesOnly: false });

  assert.equal(
    scalar(legacyDatabase, `SELECT "displayName" FROM "Customer" WHERE "id" = 'migration-customer';`),
    'Legacy Customer Updated',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "weatherNote" FROM "Assignment" WHERE "id" = 'migration-assignment';`),
    'post-migration metadata update',
  );
  assert.equal(Number(scalar(legacyDatabase, 'SELECT COUNT(*) FROM "Customer";')), 2);

  return {
    priorMigrationsApplied: targetIndex,
    before,
    after,
    canonicalPhone: '+919876543210',
    legacyCrewIncomplete: true,
    validatedChecks,
    postMigrationWrites: 3,
  };
}

function main() {
  const migrations = migrationNames();
  let cleanResult;
  let legacyResult;
  try {
    cleanResult = verifyCleanReplay(migrations);
    legacyResult = verifyPopulatedLegacyUpgrade(migrations);
    process.stdout.write(`${JSON.stringify({
      status: 'PASS',
      safety: {
        requestedDatabase,
        cleanDatabase,
        legacyDatabase,
        suffixRequired: '_test',
      },
      cleanReplay: cleanResult,
      populatedLegacyUpgrade: legacyResult,
    }, null, 2)}\n`);
  } finally {
    dropDatabase(cleanDatabase);
    dropDatabase(legacyDatabase);
  }
}

main();
