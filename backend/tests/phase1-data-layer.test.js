const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const expected = ['NEW', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING', 'MANUAL_CALL_REQUIRED', 'SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED', 'CANCELLED', 'REJECTED'];
const leadIds = [];

test.before(async () => {
  const runId = `${process.pid}-${Date.now()}`;
  for (const [index, status] of expected.entries()) {
    const lead = await prisma.lead.create({
      data: {
        farmerName: `Phase 1 ${status}`,
        farmerPhone: `95556${String(index).padStart(5, '0')}`,
        acreage: 1,
        intakeChannel: index % 2 ? 'MANUAL_SALES' : 'WEBSITE',
        status,
        notes: `phase1-${runId}-${status}`,
      },
    });
    leadIds.push(lead.id);
  }
});

test('the data layer persists only supported LeadStatus values without legacy appeal states', async () => {
  const rows = await prisma.lead.groupBy({ by: ['status'], where: { id: { in: leadIds } } });
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of expected) assert.ok(statuses.has(status), `missing ${status}`);
  assert.equal(statuses.has('OUT_OF_RANGE'), false);
  assert.equal(statuses.has('APPEAL_PENDING'), false);
});

test.after(async () => {
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.$disconnect();
});
