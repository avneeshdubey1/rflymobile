const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const autoAssignmentPolicyService = require('../services/autoAssignmentPolicyService');

const runId = `${process.pid}-${Date.now()}`;
let admin;
let policyId;

test.before(async () => {
  admin = await prisma.user.create({
    data: {
      name: 'Phase 26 Admin',
      email: `phase26-admin-${runId}@example.test`,
      passwordHash: 'not-a-real-password-hash',
      role: 'ADMIN',
    },
  });
});

test('the migration creates exactly one compatibility policy', async () => {
  const policies = await prisma.autoAssignmentPolicy.findMany();
  assert.equal(policies.length, 1);
  const policy = await autoAssignmentPolicyService.getPolicy();
  policyId = policy.id;
  assert.equal(policy.singletonKey, 'COMPANY');
  assert.equal(policy.enabled, true);
  assert.equal(policy.searchHorizonDays, 5);
  assert.equal(policy.workingDayStartMinutes, 540);
  assert.equal(policy.workingDayEndMinutes, 1080);
  assert.equal(policy.defaultJobDurationMinutes, 120);
  assert.equal(policy.turnaroundMinutes, 30);
  assert.equal(policy.maxJobsPerUnitPerDay, null);
  assert.equal(policy.maxAcreagePerUnitPerDay, null);
  assert.equal(policy.weatherUnavailableAction, 'SCHEDULE_WITH_WARNING');
  assert.equal(policy.revision, 1);
});

test('a validated update increments the revision and creates a safe audit event', async () => {
  const before = await autoAssignmentPolicyService.getPolicy();
  const after = await autoAssignmentPolicyService.updatePolicy({
    actorId: admin.id,
    expectedRevision: before.revision,
    changes: {
      enabled: false,
      searchHorizonDays: 7,
      workingDayStartMinutes: 480,
      workingDayEndMinutes: 1020,
      defaultJobDurationMinutes: 90,
      turnaroundMinutes: 20,
      maxJobsPerUnitPerDay: 6,
      maxAcreagePerUnitPerDay: '45.50',
      weatherUnavailableAction: 'MANUAL_REVIEW',
    },
  });
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.enabled, false);
  assert.equal(after.maxAcreagePerUnitPerDay.toFixed(2), '45.50');
  assert.equal(after.updatedByUserId, admin.id);

  const audit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'AutoAssignmentPolicy',
      entityId: after.id,
      action: 'AUTO_ASSIGNMENT_POLICY_UPDATED',
      actorId: admin.id,
    },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(audit);
  const serialized = JSON.stringify(audit);
  assert.doesNotMatch(serialized, /latitude|longitude|coordinate|farmerPhone|password|secret/i);
});

test('stale revisions and unsupported or unsafe values are rejected', async () => {
  const current = await autoAssignmentPolicyService.getPolicy();
  await assert.rejects(
    autoAssignmentPolicyService.updatePolicy({
      actorId: admin.id,
      expectedRevision: current.revision - 1,
      changes: { enabled: true },
    }),
    (error) => error.code === 'POLICY_REVISION_CONFLICT' && error.currentRevision === current.revision,
  );
  await assert.rejects(
    autoAssignmentPolicyService.updatePolicy({
      actorId: admin.id,
      expectedRevision: current.revision,
      changes: { workingDayStartMinutes: 1000, workingDayEndMinutes: 900 },
    }),
    (error) => error.code === 'POLICY_VALIDATION_FAILED',
  );
  await assert.rejects(
    autoAssignmentPolicyService.updatePolicy({
      actorId: admin.id,
      expectedRevision: current.revision,
      changes: { maxAcreagePerUnitPerDay: '1.234' },
    }),
    (error) => error.code === 'POLICY_VALIDATION_FAILED',
  );
  await assert.rejects(
    autoAssignmentPolicyService.updatePolicy({
      actorId: admin.id,
      expectedRevision: current.revision,
      changes: { autoAssignLeads: true },
    }),
    (error) => error.code === 'POLICY_VALIDATION_FAILED',
  );
});

test.after(async () => {
  if (policyId) {
    await prisma.autoAssignmentPolicy.update({
      where: { id: policyId },
      data: {
        enabled: true,
        searchHorizonDays: 5,
        workingDayStartMinutes: 540,
        workingDayEndMinutes: 1080,
        defaultJobDurationMinutes: 120,
        turnaroundMinutes: 30,
        maxJobsPerUnitPerDay: null,
        maxAcreagePerUnitPerDay: null,
        weatherUnavailableAction: 'SCHEDULE_WITH_WARNING',
        revision: 1,
        updatedByUserId: null,
      },
    });
    await prisma.auditLog.deleteMany({
      where: { entityType: 'AutoAssignmentPolicy', entityId: policyId },
    });
  }
  if (admin) await prisma.user.delete({ where: { id: admin.id } });
  await prisma.$disconnect();
});
