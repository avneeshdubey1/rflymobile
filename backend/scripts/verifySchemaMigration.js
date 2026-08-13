const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
const targetMigration = '20260813100000_add_assignment_crew_formation';
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

function expectPsqlFailure(databaseName, sql, expectedMessage) {
  assertDisposableDatabaseName(databaseName);
  const result = spawnSync('docker', [
    'exec', '-i', containerName,
    'psql', '-X', '-U', 'postgres', '-d', databaseName,
    '-v', 'ON_ERROR_STOP=1',
  ], {
    cwd: backendDir,
    encoding: 'utf8',
    windowsHide: true,
    input: sql,
  });
  assert.notEqual(result.status, 0, 'Expected SQL statement to fail');
  assert.match(`${result.stdout || ''}\n${result.stderr || ''}`, expectedMessage);
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

  assert.equal(Number(scalar(cleanDatabase, `
    SELECT COUNT(*) FROM "AutoAssignmentPolicy" WHERE "singletonKey" = 'COMPANY';
  `)), 1, 'Clean replay did not create exactly one company policy');

  const appliedBeforeSecondDeploy = applied;
  run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl(cleanDatabase) },
  });
  assert.equal(Number(scalar(cleanDatabase, `
    SELECT COUNT(*) FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  `)), appliedBeforeSecondDeploy, 'A second deploy unexpectedly applied another migration');

  return {
    migrationsApplied: applied,
    validatedChecks: assertAllChecksValidated(cleanDatabase),
  };
}

const legacyFixtureSql = `
INSERT INTO "OperatingCenter" ("id", "name", "latitude", "longitude", "radiusKm", "updatedAt")
VALUES ('migration-center', 'Migration Test Center', 11.0000, 77.0000, 50, CURRENT_TIMESTAMP);

INSERT INTO "User" (
  "id", "name", "email", "phone", "passwordHash", "role", "homeCenterId"
) VALUES (
  'migration-pilot', 'Legacy Pilot', 'migration-pilot@rfly.test', '+919000000001',
  'not-a-real-password-hash', 'PILOT', 'migration-center'
);

INSERT INTO "User" (
  "id", "name", "email", "phone", "passwordHash", "role", "homeCenterId"
) VALUES (
  'migration-copilot', 'Legacy Copilot', 'migration-copilot@rfly.test', '+919000000002',
  'not-a-real-password-hash', 'PILOT', 'migration-center'
);

INSERT INTO "Customer" (
  "id", "displayName", "phone", "preferredLanguage", "village", "district", "updatedAt"
) VALUES (
  'migration-customer', 'Legacy Customer', '+919876543210', 'ta',
  'Legacy Village', 'Legacy District', CURRENT_TIMESTAMP
);

INSERT INTO "Drone" (
  "id", "model", "serialNumber", "uin", "certified", "homeCenterId"
) VALUES (
  'migration-drone', 'Legacy Model', 'MIGRATION-SERIAL-1', 'MIGRATION-UIN-1', 'yes', 'migration-center'
);

INSERT INTO "LMV" (
  "id", "registrationNo", "label", "homeCenterId", "updatedAt"
) VALUES (
  'migration-lmv', 'MIGRATION-LMV-1', 'Legacy LMV', 'migration-center', CURRENT_TIMESTAMP
);

INSERT INTO "Lead" (
  "id", "customerId", "farmerName", "farmerPhone", "farmerAddress", "acreage",
  "cropType", "status", "intakeChannel", "matchedCenterId"
) VALUES (
  'migration-lead', 'migration-customer', 'Legacy Customer', '+919876543210',
  'Legacy Village, Legacy District', 2.5, 'Paddy', 'SCHEDULED', 'MANUAL_SALES', 'migration-center'
);

INSERT INTO "Lead" (
  "id", "customerId", "farmerName", "farmerPhone", "farmerAddress", "acreage",
  "cropType", "status", "intakeChannel", "matchedCenterId"
) VALUES (
  'migration-incomplete-lead', 'migration-customer', 'Legacy Customer', '+919876543210',
  'Legacy Village, Legacy District', 1.5, 'Paddy', 'SCHEDULED', 'MANUAL_SALES', 'migration-center'
);

INSERT INTO "Assignment" (
  "id", "leadId", "pilotId", "copilotId", "droneId", "lmvId",
  "scheduledDate", "serviceWindowStart", "serviceWindowEnd", "dailySequence", "expectedAcreage"
) VALUES (
  'migration-assignment', 'migration-lead', 'migration-pilot', 'migration-copilot',
  'migration-drone', 'migration-lmv', CURRENT_TIMESTAMP + INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day 120 minutes', 1, 2.5
);

ALTER TABLE "Assignment" DISABLE TRIGGER "Assignment_guard_operational_unit";
INSERT INTO "Assignment" (
  "id", "leadId", "pilotId", "droneId", "scheduledDate",
  "serviceWindowStart", "serviceWindowEnd", "dailySequence",
  "expectedAcreage", "legacyCrewIncomplete"
) VALUES (
  'migration-incomplete-assignment', 'migration-incomplete-lead',
  'migration-pilot', 'migration-drone', CURRENT_TIMESTAMP + INTERVAL '2 days',
  CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days 120 minutes',
  1, 1.5, true
);
ALTER TABLE "Assignment" ENABLE TRIGGER "Assignment_guard_operational_unit";
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
    User: 2,
    Customer: 1,
    Drone: 1,
    LMV: 1,
    Lead: 2,
    Assignment: 2,
  });

  applySqlMigration(legacyDatabase, targetMigration);
  const after = coreCounts(legacyDatabase);
  assert.deepEqual(after, before, 'Core business row counts changed during additive migration');

  assert.equal(
    scalar(legacyDatabase, `SELECT "phone" FROM "Customer" WHERE "id" = 'migration-customer';`),
    '+919876543210',
    'Canonical legacy customer phone changed during policy migration',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "legacyCrewIncomplete"::text FROM "Assignment" WHERE "id" = 'migration-assignment';`),
    'false',
    'Valid complete legacy assignment was unexpectedly quarantined',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "crewFormationState"::text FROM "Assignment" WHERE "id" = 'migration-assignment';`),
    'READY',
    'Complete assignment was not backfilled as READY',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "revision"::text FROM "Assignment" WHERE "id" = 'migration-assignment';`),
    '1',
    'Complete assignment revision was not initialized',
  );
  assert.equal(
    scalar(legacyDatabase, `SELECT "crewFormationState"::text FROM "Assignment" WHERE "id" = 'migration-incomplete-assignment';`),
    'LEGACY_INCOMPLETE',
    'Quarantined legacy assignment was not preserved as LEGACY_INCOMPLETE',
  );
  assert.equal(Number(scalar(legacyDatabase, `
    SELECT COUNT(*)
    FROM "AutoAssignmentPolicy"
    WHERE "singletonKey" = 'COMPANY'
      AND "enabled" = true
      AND "searchHorizonDays" = 5
      AND "workingDayStartMinutes" = 540
      AND "workingDayEndMinutes" = 1080
      AND "defaultJobDurationMinutes" = 120
      AND "turnaroundMinutes" = 30
      AND "weatherUnavailableAction" = 'SCHEDULE_WITH_WARNING'
      AND "revision" = 1;
  `)), 1, 'Compatibility auto-assignment policy was not created exactly once');
  assert.equal(
    scalar(legacyDatabase, `
      SELECT ("serviceWindowStart" = "scheduledDate")::text
      FROM "Assignment" WHERE "id" = 'migration-assignment';
    `),
    'true',
    'Existing assignment service-window start changed unexpectedly',
  );
  assert.equal(
    scalar(legacyDatabase, `
      SELECT ("serviceWindowEnd" = "scheduledDate" + INTERVAL '120 minutes')::text
      FROM "Assignment" WHERE "id" = 'migration-assignment';
    `),
    'true',
    'Existing assignment service-window end changed unexpectedly',
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

    INSERT INTO "Lead" (
      "id", "customerId", "farmerName", "farmerPhone", "farmerAddress", "acreage",
      "cropType", "status", "intakeChannel", "matchedCenterId"
    ) VALUES (
      'migration-pending-lead', 'migration-customer', 'Pending Customer', '+919876543210',
      'Pending Village', 1, 'Paddy', 'SCHEDULED', 'MANUAL_SALES', 'migration-center'
    );

    INSERT INTO "Assignment" (
      "id", "leadId", "pilotId", "droneId", "lmvId", "scheduledDate",
      "serviceWindowStart", "serviceWindowEnd", "expectedAcreage", "crewFormationState"
    ) VALUES (
      'migration-pending-assignment', 'migration-pending-lead', 'migration-pilot',
      'migration-drone', 'migration-lmv', CURRENT_TIMESTAMP + INTERVAL '3 days',
      CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '3 days 120 minutes',
      1, 'PENDING_COPILOT_SELECTION'
    );
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
  assert.equal(
    scalar(legacyDatabase, `SELECT "crewFormationState"::text FROM "Assignment" WHERE "id" = 'migration-pending-assignment';`),
    'PENDING_COPILOT_SELECTION',
  );
  expectPsqlFailure(
    legacyDatabase,
    `UPDATE "Assignment" SET "acceptedAt" = CURRENT_TIMESTAMP WHERE "id" = 'migration-pending-assignment';`,
    /Assignment_crew_formation_check|pending Copilot assignment must be a non-executable/i,
  );

  return {
    priorMigrationsApplied: targetIndex,
    before,
    after,
    canonicalPhone: '+919876543210',
    legacyCrewIncomplete: false,
    completeCrewFormationState: 'READY',
    incompleteCrewFormationState: 'LEGACY_INCOMPLETE',
    autoAssignmentPolicyRows: 1,
    assignmentWindowsBackfilled: true,
    validatedChecks,
    postMigrationWrites: 5,
    provisionalAssignmentWrite: true,
    prematureAcceptanceRejected: true,
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
