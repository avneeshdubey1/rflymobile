const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { parseInspectorText } = require('../importer/droneClientExport');
const { argumentsOf } = require('../importer/droneCli');
const { buildPlan } = require('../src/repositories/droneImportRepository');
const droneImportService = require('../services/droneDataImportService');
const prisma = require('../src/lib/prisma');

function sourceRow(index, overrides = {}) {
  const value = {
    battery_capacity: '16000',
    certified: true,
    date_added: '2026-01-29T15:01:37.294Z',
    drone_uas_id: '28845a56-a73c-45ef-ad72-52c7ccc2b7e7',
    drone_uin: `AGRI25TEST00${index}`,
    dsp_id: '73fd7493-3210-4ab0-8820-2c58a11ea520',
    endurance: '20',
    id: `00000000-0000-4000-8000-00000000000${index}`,
    location_id: 'ea31d21a-92b1-4f59-a93e-1a656f02cd80',
    location_name: 'Synthetic Test Centre',
    manufacturer: 'Synthetic Manufacturer',
    model_name: 'TEST-10',
    name: `UA00TEST00${index}`,
    service_type: 'Spraying service',
    tank_capacity: '10L',
    type: 'Quadcopters',
    uas_date_created: '2026-01-27T09:43:00.647Z',
    ...overrides,
  };
  return [
    `${index}: {expanded client-inspector row}`,
    ...Object.entries(value).map(([key, item]) => `${key}: ${typeof item === 'boolean' ? item : JSON.stringify(item)}`),
  ].join('\n');
}

const fixture = [
  sourceRow(0, { name: '1', drone_uin: 'UA00TEST001' }),
  sourceRow(1, { name: 'UA00TEST001', drone_uin: 'AGRI25TEST001' }),
  sourceRow(2, { name: 'UB00TEST002', drone_uin: 'AGRI25TEST002' }),
].join('\n');

test('client inspector export resolves legacy duplicate rows to canonical drones', () => {
  const result = parseInspectorText(fixture);
  assert.equal(result.assets.length, 2);
  assert.equal(result.superseded.length, 1);
  assert.equal(new Set(result.assets.map((item) => item.drone.uin)).size, 2);
  assert.equal(new Set(result.assets.map((item) => item.drone.serialNumber)).size, 2);
  assert.ok(result.assets.every((item) => item.drone.homeCenterId === undefined));
  assert.ok(result.assets.every((item) => item.drone.tankCapacityLitres === 10));
  assert.ok(result.assets.every((item) => item.drone.batteryCapacityMah === 16000));
  assert.ok(result.assets.every((item) => item.drone.enduranceMinutes === 20));
});

test('parser fails closed on truncated fields and conflicting duplicate identities', () => {
  assert.throws(() => parseInspectorText(fixture.replace(/battery_capacity: "16000"\r?\n/u, '')), { code: 'DRONE_FIELD_MISSING' });
  const conflicting = fixture.replace(/model_name: "TEST-10"/u, 'model_name: "CONFLICT"');
  assert.throws(() => parseInspectorText(conflicting), { code: 'DRONE_DUPLICATE_CONFLICT' });
});

test('CLI accepts only explicit commands and paired options', () => {
  assert.deepEqual(argumentsOf(['preflight', '--file', 'input.json']), { command: 'preflight', options: { file: 'input.json' } });
  assert.throws(() => argumentsOf(['reset', '--file', 'input.json']));
  assert.throws(() => argumentsOf(['commit', '--file']));
});

test('database plan is idempotent and refuses changed or split identities', async () => {
  const parsed = parseInspectorText(fixture);
  const input = {
    assets: parsed.assets,
    centerId: 'center-1',
    fileChecksum: 'a'.repeat(64),
    mappingVersion: 'CLIENT_DRONE_INSPECTOR_V1',
  };
  const createPlan = buildPlan({ ...input, existing: [] });
  assert.equal(createPlan.counts.CREATE, 2);
  assert.equal(createPlan.counts.SKIP_EXACT, 0);

  const exact = input.assets.map((item, index) => ({
    id: `drone-${index}`,
    ...item.drone,
    homeCenterId: input.centerId,
  }));
  const exactPlan = buildPlan({ ...input, existing: exact });
  assert.equal(exactPlan.counts.SKIP_EXACT, 2);
  assert.equal(exactPlan.counts.REVIEW_EXISTING_DIFFERENCE, 0);

  const changed = exact.map((item, index) => index === 0 ? { ...item, model: 'Unexpected model' } : item);
  const changedPlan = buildPlan({ ...input, existing: changed });
  assert.equal(changedPlan.counts.REVIEW_EXISTING_DIFFERENCE, 1);

  const split = [
    { ...exact[0], id: 'serial-owner', uin: 'UNRELATED-UIN' },
    { ...exact[0], id: 'uin-owner', serialNumber: 'UNRELATED-SERIAL' },
  ];
  const splitPlan = buildPlan({ ...input, assets: input.assets.slice(0, 1), existing: split });
  assert.equal(splitPlan.counts.CONFLICT_SPLIT_IDENTITY, 1);
});

test('guarded commit creates canonical drones once and records history and audit evidence', async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const filePath = path.join(os.tmpdir(), `rfly-drone-import-${suffix}.json`);
  const email = `drone-import-${suffix}@rfly.test`;
  const centerCode = `DI-${suffix}`.slice(0, 40);
  const originalDeployment = process.env.DEPLOYMENT_NAME;
  let actor;
  let center;
  await fs.writeFile(filePath, fixture, { encoding: 'utf8', flag: 'wx' });
  try {
    actor = await prisma.user.create({
      data: { name: 'Drone Import Test Admin', email, passwordHash: 'not-a-real-password-hash', role: 'ADMIN', active: true },
      select: { id: true },
    });
    center = await prisma.operatingCenter.create({
      data: { code: centerCode, name: 'Drone Import Test Centre', latitude: 11, longitude: 77, active: true },
      select: { id: true },
    });
    process.env.DEPLOYMENT_NAME = 'rfly-drone-import-test';
    const plan = await droneImportService.plan({ filePath, actorId: actor.id, centerId: center.id });
    assert.equal(plan.counts.CREATE, 2);
    await assert.rejects(
      droneImportService.commit({
        filePath, actorId: actor.id, centerId: center.id, expectedPlanHash: plan.planHash,
        expectedDeployment: process.env.DEPLOYMENT_NAME, confirmation: 'WRONG', backupReference: 'test-backup-evidence',
      }),
      { code: 'DRONE_IMPORT_CONFIRMATION_REQUIRED' },
    );
    const committed = await droneImportService.commit({
      filePath, actorId: actor.id, centerId: center.id, expectedPlanHash: plan.planHash,
      expectedDeployment: process.env.DEPLOYMENT_NAME, confirmation: 'IMPORT_DRONES', backupReference: 'test-backup-evidence',
    });
    assert.deepEqual({ created: committed.created, skipped: committed.skipped, total: committed.total }, { created: 2, skipped: 0, total: 2 });

    const rerunPlan = await droneImportService.plan({ filePath, actorId: actor.id, centerId: center.id });
    assert.equal(rerunPlan.counts.SKIP_EXACT, 2);
    const rerun = await droneImportService.commit({
      filePath, actorId: actor.id, centerId: center.id, expectedPlanHash: rerunPlan.planHash,
      expectedDeployment: process.env.DEPLOYMENT_NAME, confirmation: 'IMPORT_DRONES', backupReference: 'test-backup-evidence',
    });
    assert.deepEqual({ created: rerun.created, skipped: rerun.skipped, total: rerun.total }, { created: 0, skipped: 2, total: 2 });

    const drones = await prisma.drone.findMany({ where: { homeCenterId: center.id }, select: { id: true, serialNumber: true, uin: true } });
    assert.equal(drones.length, 2);
    assert.equal(await prisma.droneHistory.count({ where: { droneId: { in: drones.map((item) => item.id) }, eventType: 'CREATED', actorUserId: actor.id } }), 2);
    assert.equal(await prisma.auditLog.count({ where: { actorId: actor.id, action: 'IMPORTED', entityType: 'Drone' } }), 2);
    assert.equal(await prisma.auditLog.count({ where: { actorId: actor.id, action: 'IMPORT_COMMITTED', entityType: 'DroneImport' } }), 2);
  } finally {
    process.env.DEPLOYMENT_NAME = originalDeployment;
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
      if (actor) await transaction.auditLog.deleteMany({ where: { actorId: actor.id } });
      if (center) await transaction.drone.deleteMany({ where: { homeCenterId: center.id } });
      if (center) await transaction.operatingCenter.deleteMany({ where: { id: center.id } });
      if (actor) await transaction.user.deleteMany({ where: { id: actor.id } });
    });
    await fs.unlink(filePath).catch(() => {});
  }
});

test.after(async () => prisma.$disconnect());
