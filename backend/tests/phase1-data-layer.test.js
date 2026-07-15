const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const expected = ['NEW', 'OUT_OF_RANGE', 'APPEAL_PENDING', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING', 'SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED', 'CANCELLED', 'REJECTED'];
const leadIds = [];

test.before(async () => {
  const runId = `${process.pid}-${Date.now()}`;
  for (const [index, status] of expected.entries()) {
    const lead = await prisma.lead.create({
      data: {
        farmerName: `Phase 1 ${status}`,
        farmerPhone: `95556${String(index).padStart(5, '0')}`,
        acreage: 1,
        intakeChannel: 'WEBSITE',
        status,
        formResponseId: `phase1-${runId}-${status}`,
      },
    });
    leadIds.push(lead.id);
  }
});

test('the data layer persists every LeadStatus without relying on shared seed state', async () => {
  const rows = await prisma.lead.groupBy({ by: ['status'], where: { id: { in: leadIds } } });
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of expected) assert.ok(statuses.has(status), `missing ${status}`);
});

test.after(async () => {
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.$disconnect();
});
