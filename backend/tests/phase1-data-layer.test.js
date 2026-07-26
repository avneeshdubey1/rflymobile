const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const expected = ['NEW', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING', 'MANUAL_CALL_REQUIRED', 'SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED', 'CANCELLED', 'REJECTED'];
const leadIds = [];
let centerId;
let lmvId;

test.before(async () => {
  const runId = `${process.pid}-${Date.now()}`;
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 1 LMV ${runId}`, latitude: 10, longitude: 77, radiusKm: 50 } });
  centerId = center.id;
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

test('the data layer persists lightweight LMV statuses and center linkage', async () => {
  const lmv = await prisma.lMV.create({
    data: {
      registrationNo: `TN-TEST-${Date.now()}`,
      label: 'Phase 1 Test LMV',
      homeCenterId: centerId,
      capacity: 1,
      notes: 'lightweight first release',
    },
    include: { homeCenter: true },
  });
  lmvId = lmv.id;
  assert.equal(lmv.status, 'AVAILABLE');
  assert.equal(lmv.capacity, 1);
  assert.equal(lmv.homeCenter.id, centerId);

  const statuses = await prisma.lMV.groupBy({ by: ['status'], where: { id: lmv.id } });
  assert.deepEqual(statuses.map((row) => row.status), ['AVAILABLE']);
});

test.after(async () => {
  if (lmvId) await prisma.lMV.delete({ where: { id: lmvId } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  if (centerId) await prisma.operatingCenter.delete({ where: { id: centerId } });
  await prisma.$disconnect();
});
