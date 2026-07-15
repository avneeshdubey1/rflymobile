const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

let server;
let baseUrl;
let sales;
let pilot;
let center;
let assignment;
let scheduledLead;
const deliveries = [];
const ids = { users: [], drones: [], assignedDrones: [], leads: [], assignments: [], appeals: [] };
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

function templatesFor(leadId) {
  return deliveries.filter((delivery) => delivery.leadId === leadId).map((delivery) => delivery.templateKey);
}

test.before(async () => {
  whatsappService.setClient({ send: async (delivery) => {
    deliveries.push(delivery);
    return { id: `phase7-${deliveries.length}` };
  } });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({ data: { name: `Phase 7 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } });
  [sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 7 Sales', email: `phase7-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 7 Pilot', email: `phase7-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(sales.id, pilot.id);
  const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE7-DRONE-${runId}`, status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: new Date('2027-01-01') } });
  ids.drones.push(drone.id);
});

test('lead processing, scheduling, mission start, and completion each send the correct English template', async () => {
  scheduledLead = await prisma.lead.create({ data: { farmerName: 'Phase 7 English Farmer', farmerPhone: '955550007', acreage: 3, intakeChannel: 'GOOGLE_FORM', status: 'NEW', preferredLanguage: 'en', latitude: 11, longitude: 76, matchedCenterId: center.id } });
  ids.leads.push(scheduledLead.id);
  const processedResponse = await fetch(`${baseUrl}/api/leads/process`, { method: 'POST', headers: auth(sales), body: JSON.stringify({ id: scheduledLead.id, employeeId: sales.id }) });
  const processed = await processedResponse.json();
  assert.equal(processedResponse.status, 200);
  assignment = processed.assignment.assignment;
  ids.assignments.push(assignment.id);
  ids.assignedDrones.push(assignment.droneId);
  assert.deepEqual(templatesFor(scheduledLead.id), ['lead_processed', 'mission_scheduled']);
  assert.match(deliveries.find((delivery) => delivery.templateKey === 'mission_scheduled').text, /pilot has been scheduled/i);

  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/accept`, { method: 'POST', headers: auth(pilot) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/start`, { method: 'POST', headers: auth(pilot) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 3.5 }) })).status, 200);
  assert.deepEqual(templatesFor(scheduledLead.id), ['lead_processed', 'mission_scheduled', 'mission_started', 'mission_completed']);
  assert.match(deliveries.find((delivery) => delivery.templateKey === 'mission_completed').text, /3.5 acres covered/i);
});

test('appeal outcomes use the lead language, and no configured client safely records a mock delivery', async () => {
  const [approvedLead, rejectedLead] = await Promise.all([
    prisma.lead.create({ data: { farmerName: 'Phase 7 Tamil Farmer', farmerPhone: '955550008', acreage: 2, intakeChannel: 'WEBSITE', status: 'OUT_OF_RANGE', preferredLanguage: 'ta', latitude: 11, longitude: 76 } }),
    prisma.lead.create({ data: { farmerName: 'Phase 7 Rejected Farmer', farmerPhone: '955550009', acreage: 2, intakeChannel: 'WEBSITE', status: 'OUT_OF_RANGE', preferredLanguage: 'en', latitude: 11, longitude: 76 } }),
  ]);
  ids.leads.push(approvedLead.id, rejectedLead.id);
  const [approvedAppeal, rejectedAppeal] = await Promise.all([
    prisma.outOfRangeAppeal.create({ data: { leadId: approvedLead.id, distanceKm: 60, excessKm: 10, suggestedFee: 150 } }),
    prisma.outOfRangeAppeal.create({ data: { leadId: rejectedLead.id, distanceKm: 60, excessKm: 10, suggestedFee: 150 } }),
  ]);
  ids.appeals.push(approvedAppeal.id, rejectedAppeal.id);
  const approvedResponse = await fetch(`${baseUrl}/api/leads/${approvedLead.id}/appeal/review`, { method: 'POST', headers: auth(sales), body: JSON.stringify({ decision: 'APPROVED', finalFee: 150 }) });
  const approvedBody = await approvedResponse.json();
  assert.equal(approvedResponse.status, 200);
  if (approvedBody.assignment?.assignment) {
    ids.assignments.push(approvedBody.assignment.assignment.id);
    ids.assignedDrones.push(approvedBody.assignment.assignment.droneId);
  }
  assert.equal((await fetch(`${baseUrl}/api/leads/${rejectedLead.id}/appeal/review`, { method: 'POST', headers: auth(sales), body: JSON.stringify({ decision: 'REJECTED', reviewedBy: sales.id }) })).status, 200);
  const approvedDelivery = deliveries.find((delivery) => delivery.templateKey === 'appeal_approved');
  const rejectedDelivery = deliveries.find((delivery) => delivery.templateKey === 'appeal_rejected');
  assert.equal(approvedDelivery.language, 'ta');
  assert.match(approvedDelivery.text, /அங்கீகரிக்கப்பட்டது/);
  assert.equal(rejectedDelivery.language, 'en');

  whatsappService.setClient(null);
  const mocked = await whatsappService.sendLeadMessage(approvedLead, 'lead_processed');
  assert.equal(mocked.status, 'MOCKED');
});

test.after(async () => {
  whatsappService.setClient(null);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments] } } });
  await prisma.paymentRecord.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.drone.updateMany({ where: { id: { in: ids.assignedDrones.filter((id) => !ids.drones.includes(id)) } }, data: { status: 'AVAILABLE' } });
  await prisma.outOfRangeAppeal.deleteMany({ where: { id: { in: ids.appeals } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: center.id } });
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  await prisma.$disconnect();
});
