const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');

const runId = `${process.pid}-${Date.now()}`;
const password = 'phase34-password-strong';
const ids = { users: [], centers: [], drones: [], lmvs: [], leads: [], assignments: [], installations: [] };
let server;
let baseUrl;
let fleetToken;
let adminToken;
let salesToken;
let assignment;
let manualLead;
let from;
let to;

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

async function login(user) {
  const result = await request('/api/mobile/v1/operations/auth/login', {
    method: 'POST',
    body: {
      email: user.email,
      password,
      installationKey: crypto.randomBytes(48).toString('base64url'),
      platform: 'ANDROID',
      appVersion: '1.0.0',
      deviceLabel: 'Phase 34 synthetic device',
    },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  ids.installations.push(result.data.installation.id);
  return result.data.session.accessToken;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const now = new Date();
  from = new Date(now.getTime() - 60 * 60_000);
  to = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
  const center = await prisma.operatingCenter.create({
    data: { name: `Phase 34 Centre ${runId}`, code: `P34-${runId}`, latitude: 11.4, longitude: 77.1 },
  });
  ids.centers.push(center.id);
  const passwordHash = await hashPassword(password);
  const [fleet, admin, sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'P34 Fleet', email: `p34-fleet-${runId}@example.test`, passwordHash, role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'P34 Admin', email: `p34-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'P34 Sales', email: `p34-sales-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'P34 Pilot', email: `p34-pilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(fleet.id, admin.id, sales.id, pilot.id);
  [fleetToken, adminToken, salesToken] = await Promise.all([login(fleet), login(admin), login(sales)]);
  const [drone, lmv] = await Promise.all([
    prisma.drone.create({ data: { name: 'P34 Drone', model: 'P34', serialNumber: `P34-D-${runId}`, homeCenterId: center.id, status: 'ASSIGNED' } }),
    prisma.lMV.create({ data: { registrationNo: `P34-L-${runId}`, label: 'P34 LMV', homeCenterId: center.id, status: 'ASSIGNED' } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const scheduledLead = await prisma.lead.create({
    data: {
      farmerName: 'P34 Scheduled Farmer', farmerPhone: '+919000000034', farmerAddress: 'Sensitive address omitted',
      acreage: 3, acreageDecimal: '3.00', cropType: 'P34 Crop', intakeChannel: 'MANUAL_SALES', status: 'SCHEDULED',
      latitude: 11.4, longitude: 77.1, matchedCenterId: center.id,
    },
  });
  manualLead = await prisma.lead.create({
    data: {
      farmerName: 'P34 Manual Farmer', farmerPhone: '+919000000035', farmerAddress: 'Sensitive manual address omitted',
      acreage: 4, acreageDecimal: '4.00', cropType: 'P34 Crop', intakeChannel: 'MANUAL_SALES', status: 'NEEDS_MANUAL_SCHEDULING',
      latitude: 11.4, longitude: 77.1, matchedCenterId: center.id,
    },
  });
  ids.leads.push(scheduledLead.id, manualLead.id);
  assignment = await prisma.assignment.create({
    data: {
      leadId: scheduledLead.id,
      pilotId: pilot.id,
      droneId: drone.id,
      lmvId: lmv.id,
      crewFormationState: 'PENDING_COPILOT_SELECTION',
      scheduledDate: new Date(now.getTime() + 24 * 60 * 60_000),
      serviceWindowStart: new Date(now.getTime() + 24 * 60 * 60_000),
      serviceWindowEnd: new Date(now.getTime() + 26 * 60 * 60_000),
      expectedAcreage: 3,
    },
  });
  ids.assignments.push(assignment.id);
});

function query(path) {
  return `${path}?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

test('Fleet schedule is bounded, ordered and omits private contact/location data', async () => {
  const result = await request(query('/api/mobile/v1/operations/fleet/schedule'), { token: fleetToken });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const item = result.data.assignments.find((candidate) => candidate.id === assignment.id);
  assert.ok(item);
  assert.equal(item.crewFormationState, 'PENDING_COPILOT_SELECTION');
  assert.equal(item.crew.copilot, null);
  assert.equal(item.drone.status, 'ASSIGNED');
  assert.equal(item.lmv.status, 'ASSIGNED');
  assert.equal(JSON.stringify(item).match(/farmerPhone|latitude|longitude|farmerAddress|issueNote/i), null);

  const tooWideFrom = new Date(from.getTime() - 20 * 24 * 60 * 60_000).toISOString();
  const tooWide = await request(`/api/mobile/v1/operations/fleet/schedule?from=${encodeURIComponent(tooWideFrom)}&to=${encodeURIComponent(to.toISOString())}`, { token: fleetToken });
  assert.equal(tooWide.response.status, 400);
  assert.equal(tooWide.data.error.code, 'VALIDATION_FAILED');
  const malformed = await request(`${query('/api/mobile/v1/operations/fleet/schedule')}&pilotId=${ids.users[3]}`, { token: fleetToken });
  assert.equal(malformed.response.status, 400);
});

test('Fleet exceptions distinguish pending crew from unscheduled leads', async () => {
  const result = await request(query('/api/mobile/v1/operations/fleet/exceptions'), { token: adminToken });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const crewException = result.data.exceptions.find((item) => item.id === assignment.id);
  const leadException = result.data.exceptions.find((item) => item.id === manualLead.id);
  assert.equal(crewException.type, 'ASSIGNMENT');
  assert.deepEqual(crewException.codes, ['COPILOT_SELECTION_PENDING']);
  assert.equal(crewException.assignment.revision, assignment.revision);
  assert.equal(leadException.type, 'UNSCHEDULED_LEAD');
  assert.deepEqual(leadException.codes, ['NEEDS_MANUAL_SCHEDULING']);
  assert.equal(leadException.assignment, null);
  assert.equal(JSON.stringify(result.data).match(/9000000034|9000000035|Sensitive/i), null);
});

test('Sales mobile sessions cannot read or mutate Fleet schedule capabilities', async () => {
  const schedule = await request(query('/api/mobile/v1/operations/fleet/schedule'), { token: salesToken });
  const exceptions = await request(query('/api/mobile/v1/operations/fleet/exceptions'), { token: salesToken });
  const override = await request(`/api/mobile/v1/operations/assignments/${assignment.id}/copilot-override`, {
    method: 'POST', token: salesToken, body: { candidateId: ids.users[3], expectedRevision: assignment.revision, reason: 'Denied role' },
  });
  assert.equal(schedule.response.status, 403);
  assert.equal(exceptions.response.status, 403);
  assert.equal(override.response.status, 403);
  assert.equal(override.data.error.code, 'ROLE_NOT_ALLOWED');
});

test.after(async () => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
    await transaction.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
    await transaction.auditLog.deleteMany({ where: { OR: [
      { entityType: 'Lead', entityId: { in: ids.leads } },
      { entityType: 'Assignment', entityId: { in: ids.assignments } },
      { entityType: 'MobileSession' },
      { entityType: 'MobileInstallation' },
    ] } });
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.mobileSession.deleteMany({ where: { installationId: { in: ids.installations } } });
    await transaction.mobileInstallation.deleteMany({ where: { id: { in: ids.installations } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
