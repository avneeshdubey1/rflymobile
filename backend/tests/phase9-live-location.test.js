const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const { installChatSocket } = require('../sockets/chatSocket');
const { installLocationSocket } = require('../sockets/locationSocket');

let server;
let io;
let baseUrl;
let center;
let admin;
let fleet;
let pilot;
let assignment;
let watcher;
let pilotSocket;
const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], drones: [], leads: [], assignments: [] };
const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, { auth: { token: issueToken(user) }, transports: ['websocket'] });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) => socket.emit(event, payload, (result) => result?.success ? resolve(result) : reject(new Error(result?.error || 'Socket request failed'))));
}

test.before(async () => {
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);
  installChatSocket(io);
  installLocationSocket(io);
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  center = await prisma.operatingCenter.create({ data: { name: `Phase 9 Centre ${runId}`, latitude: 11, longitude: 76 } });
  [admin, fleet, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 9 Admin', email: `phase9-admin-${runId}@example.test`, passwordHash: 'test', role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Phase 9 Fleet', email: `phase9-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 9 Pilot', email: `phase9-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(admin.id, fleet.id, pilot.id);
  const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE9-DRONE-${runId}`, status: 'ASSIGNED', homeCenterId: center.id } });
  ids.drones.push(drone.id);
  const lead = await prisma.lead.create({ data: { farmerName: 'Phase 9 Farmer', farmerPhone: '955550009', acreage: 3, intakeChannel: 'MANUAL_SALES', status: 'PILOT_ACCEPTED', matchedCenterId: center.id } });
  ids.leads.push(lead.id);
  assignment = await prisma.assignment.create({ data: { leadId: lead.id, pilotId: pilot.id, droneId: drone.id, scheduledDate: new Date(), expectedAcreage: 3 } });
  ids.assignments.push(assignment.id);
});

test('only the assigned pilot can send a current GPS location, and Fleet can read it', async () => {
  const sentResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}/location`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ latitude: 11.12345, longitude: 76.54321 }) });
  const sent = await sentResponse.json();
  assert.equal(sentResponse.status, 200);
  assert.equal(sent.location.latitude, 11.12345);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/location`, { method: 'POST', headers: auth(fleet), body: JSON.stringify({ latitude: 11, longitude: 76 }) })).status, 403);

  const fetchedResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}/location`, { headers: auth(fleet) });
  const fetched = await fetchedResponse.json();
  assert.equal(fetchedResponse.status, 200);
  assert.equal(fetched.location.longitude, 76.54321);
  assert.ok(fetched.location.lastPingAt);
});

test('Fleet receives an authenticated Socket.io live-location update', async () => {
  watcher = await connect(fleet);
  pilotSocket = await connect(pilot);
  const watching = await acknowledge(watcher, 'location:watch', { assignmentId: assignment.id });
  assert.equal(watching.location.assignmentId, assignment.id);
  const incoming = new Promise((resolve) => watcher.once('location:update', resolve));
  const sent = await acknowledge(pilotSocket, 'location:ping', { assignmentId: assignment.id, latitude: 11.2, longitude: 76.6 });
  const broadcast = await incoming;
  assert.equal(sent.location.latitude, 11.2);
  assert.equal(broadcast.longitude, 76.6);
  const audit = await prisma.auditLog.findFirst({ where: { entityId: assignment.id, action: 'GPS_LOCATION_UPDATED' } });
  assert.ok(audit);
  assert.equal(audit.afterState.locationRecorded, true);
  assert.equal(Object.hasOwn(audit.afterState, 'latitude'), false);
  assert.equal(Object.hasOwn(audit.afterState, 'longitude'), false);
});

test('mission completion after GPS does not copy exact location or farmer contact data into audit snapshots', async () => {
  const started = await fetch(`${baseUrl}/api/assignments/${assignment.id}/start`, { method: 'POST', headers: auth(pilot), body: '{}' });
  assert.equal(started.status, 200, await started.text());
  const completed = await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 3 }) });
  assert.equal(completed.status, 200, await completed.text());

  const audit = await prisma.auditLog.findFirst({ where: { entityId: assignment.id, action: 'MISSION_COMPLETED' } });
  const keys = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => {
      keys.push(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
      visit(item);
    });
  };
  visit({ beforeState: audit.beforeState, afterState: audit.afterState });
  for (const privateKey of ['farmerphone', 'farmeraddress', 'latitude', 'longitude', 'lastknownlat', 'lastknownlng']) {
    assert.equal(keys.includes(privateKey), false);
  }
});

test.after(async () => {
  watcher?.disconnect();
  pilotSocket?.disconnect();
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.assignments, ...ids.leads] } } });
  await prisma.paymentRecord.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: center.id } });
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
