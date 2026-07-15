const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

let server;
let baseUrl;
let center;
let sales;
let pilot;
let originalRate;
const ids = { users: [], drones: [], leads: [], assignments: [], payments: [] };
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

async function createInProgressMission(label, acreage) {
  const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE8-${label}-${runId}`, status: 'ASSIGNED', homeCenterId: center.id, airworthinessExpiry: new Date('2027-01-01') } });
  const lead = await prisma.lead.create({ data: { farmerName: `Phase 8 ${label}`, farmerPhone: `955558${label}`, acreage, intakeChannel: 'MANUAL_SALES', status: 'IN_PROGRESS', preferredLanguage: 'en', latitude: 11, longitude: 76, matchedCenterId: center.id } });
  const assignment = await prisma.assignment.create({ data: { leadId: lead.id, pilotId: pilot.id, droneId: drone.id, scheduledDate: new Date(), expectedAcreage: acreage, acceptedAt: new Date(), startedAt: new Date() } });
  ids.drones.push(drone.id);
  ids.leads.push(lead.id);
  ids.assignments.push(assignment.id);
  return assignment;
}

test.before(async () => {
  paymentService.setUpiClient(null);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({ data: { name: `Phase 8 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } });
  [sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 8 Sales', email: `phase8-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 8 Pilot', email: `phase8-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(sales.id, pilot.id);
  originalRate = await prisma.pricingConfig.findUnique({ where: { key: 'SPRAY_RATE_PER_ACRE' } });
  await prisma.pricingConfig.upsert({ where: { key: 'SPRAY_RATE_PER_ACRE' }, update: { value: 250 }, create: { key: 'SPRAY_RATE_PER_ACRE', value: 250 } });
});

test('mission completion creates a pending cash fallback, and Sales can mark it collected', async () => {
  const assignment = await createInProgressMission('Cash Farmer', 3.5);
  const completedResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 3.5 }) });
  const completed = await completedResponse.json();
  assert.equal(completedResponse.status, 200);
  const payment = completed.payment.payment;
  ids.payments.push(payment.id);
  assert.equal(payment.method, 'CASH');
  assert.equal(payment.status, 'PENDING');
  assert.equal(payment.amount, 875);

  const pendingResponse = await fetch(`${baseUrl}/api/payments/pending`, { headers: auth(sales) });
  const pending = await pendingResponse.json();
  assert.equal(pendingResponse.status, 200);
  assert.equal(pending.payments.some((item) => item.id === payment.id), true);
  const cashResponse = await fetch(`${baseUrl}/api/payments/${payment.id}/mark-cash`, { method: 'POST', headers: auth(sales) });
  const cash = await cashResponse.json();
  assert.equal(cashResponse.status, 200);
  assert.equal(cash.payment.status, 'COMPLETED');
  assert.equal(cash.payment.markedCashBy, sales.id);
});

test('a configured provider creates a UPI link and a verified webhook completes the payment', async () => {
  const assignment = await createInProgressMission('UPI Farmer', 2);
  const completedResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 2 }) });
  const completed = await completedResponse.json();
  const payment = completed.payment.payment;
  ids.payments.push(payment.id);
  paymentService.setUpiClient({ createPaymentLink: async () => ({ upiLink: 'https://payments.example.test/upi/phase8', transactionId: 'upi-phase8' }) });
  const linkResponse = await fetch(`${baseUrl}/api/payments/${assignment.id}/generate-link`, { method: 'POST', headers: auth(sales) });
  const linked = await linkResponse.json();
  assert.equal(linkResponse.status, 200);
  assert.equal(linked.payment.method, 'UPI');
  assert.equal(linked.payment.upiLink, 'https://payments.example.test/upi/phase8');

  process.env.UPI_WEBHOOK_SECRET = 'phase8-test-secret';
  const webhookResponse = await fetch(`${baseUrl}/api/payments/${payment.id}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upi-webhook-secret': 'phase8-test-secret' }, body: JSON.stringify({ status: 'COMPLETED', transactionId: 'upi-settled-phase8' }) });
  const webhook = await webhookResponse.json();
  assert.equal(webhookResponse.status, 200);
  assert.equal(webhook.payment.status, 'COMPLETED');
  assert.equal(webhook.payment.upiTransactionId, 'upi-settled-phase8');
  delete process.env.UPI_WEBHOOK_SECRET;
});

test.after(async () => {
  delete process.env.UPI_WEBHOOK_SECRET;
  paymentService.setUpiClient(null);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments, ...ids.payments] } } });
  await prisma.paymentRecord.deleteMany({ where: { id: { in: ids.payments } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: center.id } });
  if (originalRate) await prisma.pricingConfig.update({ where: { key: 'SPRAY_RATE_PER_ACRE' }, data: { value: originalRate.value } });
  else await prisma.pricingConfig.delete({ where: { key: 'SPRAY_RATE_PER_ACRE' } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
