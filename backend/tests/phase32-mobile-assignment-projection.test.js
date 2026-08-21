const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const assignments = require('../src/repositories/assignmentOperationRepository');
const { hashPassword } = require('../services/passwordService');
const { purgeExpired } = require('../jobs/mobileAssignmentChangePurgeJob');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [], installations: [] };
const password = 'phase32-password-strong';
let server;
let baseUrl;
let center;
let primary;
let copilot;
let outsider;
let fleet;
let drone;
let lmv;
let assignment;
let primaryToken;
let copilotToken;
let outsiderToken;
let fleetToken;
let syncCursor;

function loginBody(user) {
  return {
    email: user.email,
    password,
    installationKey: crypto.randomBytes(48).toString('base64url'),
    platform: 'ANDROID',
    appVersion: '1.0.0',
    deviceLabel: 'Phase 32 synthetic device',
  };
}

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

async function login(user, route) {
  const result = await request(`/api/mobile/v1/${route}/auth/login`, { method: 'POST', body: loginBody(user) });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  ids.installations.push(result.data.installation.id);
  return result.data.session.accessToken;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({
    data: { name: `Phase 32 Centre ${runId}`, code: `P32-${runId}`, latitude: 11.5, longitude: 77.2 },
  });
  ids.centers.push(center.id);
  const passwordHash = await hashPassword(password);
  [primary, copilot, outsider, fleet] = await Promise.all([
    prisma.user.create({ data: { name: 'P32 Primary', email: `p32-primary-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01') } }),
    prisma.user.create({ data: { name: 'P32 Copilot', email: `p32-copilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01') } }),
    prisma.user.create({ data: { name: 'P32 Outsider', email: `p32-outsider-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01') } }),
    prisma.user.create({ data: { name: 'P32 Fleet', email: `p32-fleet-${runId}@example.test`, passwordHash, role: 'FLEET_MANAGER' } }),
  ]);
  ids.users.push(primary.id, copilot.id, outsider.id, fleet.id);
  [drone, lmv] = await Promise.all([
    prisma.drone.create({ data: { name: 'P32 Drone', model: 'P32', serialNumber: `P32-D-${runId}`, homeCenterId: center.id } }),
    prisma.lMV.create({ data: { registrationNo: `P32-L-${runId}`, label: 'P32 Vehicle', homeCenterId: center.id } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const lead = await prisma.lead.create({
    data: {
      farmerName: 'P32 Farmer', farmerPhone: '9000000032', farmerAddress: 'P32 Assigned Farm', acreage: 4.5,
      acreageDecimal: '4.50', cropType: 'Rice', notes: 'Use approved field procedure.', intakeChannel: 'MANUAL_SALES',
      status: 'PROCESSED', latitude: 11.5001, longitude: 77.2001, matchedCenterId: center.id,
    },
  });
  ids.leads.push(lead.id);
  const scheduled = await assignments.manualAssign({
    leadId: lead.id,
    pilotId: primary.id,
    droneId: drone.id,
    lmvId: lmv.id,
    serviceWindowStart: new Date(Date.now() + 24 * 60 * 60_000),
    serviceWindowEnd: new Date(Date.now() + 26 * 60 * 60_000),
    actorId: fleet.id,
  });
  assignment = scheduled.assignment;
  ids.assignments.push(assignment.id);
  [primaryToken, copilotToken, outsiderToken, fleetToken] = await Promise.all([
    login(primary, 'pilot'), login(copilot, 'pilot'), login(outsider, 'pilot'), login(fleet, 'operations'),
  ]);
});

test('only assigned Pilots receive bounded allow-listed assignment DTOs', async () => {
  const bootstrap = await request('/api/mobile/v1/pilot/bootstrap', { token: primaryToken });
  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.data));
  syncCursor = bootstrap.data.sync.cursor;
  const list = await request('/api/mobile/v1/pilot/assignments', { token: primaryToken });
  assert.equal(list.response.status, 200, JSON.stringify(list.data));
  assert.equal(list.data.assignments.length, 1);
  const projected = list.data.assignments[0];
  assert.equal(projected.id, assignment.id);
  assert.equal(projected.crewFormationState, 'PENDING_COPILOT_SELECTION');
  assert.deepEqual(projected.allowedActions, ['SELECT_COPILOT', 'REJECT']);
  assert.equal(projected.crew.length, 1);
  assert.equal(projected.farmer.operationalPhone, '+919000000032');
  assert.equal(projected.farmer.crmHistory, undefined);
  assert.equal(projected.drone.airworthinessExpiry, undefined);
  assert.equal(projected.lmv.notes, undefined);

  const hidden = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}`, { token: outsiderToken });
  assert.equal(hidden.response.status, 404);
  assert.equal(hidden.data.error.code, 'RESOURCE_NOT_FOUND');
  const invalidRange = await request('/api/mobile/v1/pilot/assignments?from=2099-01-01T00:00:00.000Z&to=2099-03-01T00:00:00.000Z', { token: primaryToken });
  assert.equal(invalidRange.response.status, 400);
});

test('Primary selects an eligible Copilot once and both crew members can then read the assignment', async () => {
  const candidates = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/eligible-copilots`, { token: primaryToken });
  assert.equal(candidates.response.status, 200, JSON.stringify(candidates.data));
  assert.ok(candidates.data.candidates.some((candidate) => candidate.id === copilot.id));
  assert.equal(candidates.data.candidates[0].phone, undefined);
  assert.equal(candidates.data.candidates[0].pilotLicenseExpiry, undefined);

  const offline = await request('/api/mobile/v1/pilot/availability', {
    method: 'PUT', token: outsiderToken, body: { state: 'OFFLINE' },
  });
  assert.equal(offline.response.status, 200, JSON.stringify(offline.data));
  assert.equal(offline.data.profile.pilotAvailabilityState, 'OFFLINE');
  const withoutOfflinePilot = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/eligible-copilots`, { token: primaryToken });
  assert.equal(withoutOfflinePilot.response.status, 200, JSON.stringify(withoutOfflinePilot.data));
  assert.equal(withoutOfflinePilot.data.candidates.some((candidate) => candidate.id === outsider.id), false);
  const available = await request('/api/mobile/v1/pilot/availability', {
    method: 'PUT', token: outsiderToken, body: { state: 'AVAILABLE' },
  });
  assert.equal(available.response.status, 200, JSON.stringify(available.data));

  const selected = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/copilot`, {
    method: 'POST',
    token: primaryToken,
    body: { candidateId: copilot.id, expectedRevision: assignment.revision },
  });
  assert.equal(selected.response.status, 200, JSON.stringify(selected.data));
  assert.equal(selected.data.assignment.crewFormationState, 'READY');
  assert.equal(selected.data.assignment.crew.length, 2);
  assert.deepEqual(selected.data.assignment.allowedActions, ['ACCEPT', 'REJECT']);

  const activeCrewCannotGoOffline = await request('/api/mobile/v1/pilot/availability', {
    method: 'PUT', token: primaryToken, body: { state: 'OFFLINE' },
  });
  assert.equal(activeCrewCannotGoOffline.response.status, 409);
  assert.equal(activeCrewCannotGoOffline.data.error.code, 'ACTIVE_ASSIGNMENT_BLOCKS_OFFLINE');

  const copilotView = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}`, { token: copilotToken });
  assert.equal(copilotView.response.status, 200);
  assert.equal(copilotView.data.assignment.id, assignment.id);
  const stale = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/copilot`, {
    method: 'POST', token: primaryToken, body: { candidateId: outsider.id, expectedRevision: assignment.revision },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, 'ASSIGNMENT_REVISION_CONFLICT');
});

test('Operations override requires Fleet or Admin and records a reasoned audit', async () => {
  const current = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  const overridden = await request(`/api/mobile/v1/operations/assignments/${assignment.id}/copilot-override`, {
    method: 'POST',
    token: fleetToken,
    body: { candidateId: outsider.id, expectedRevision: current.revision, reason: 'Copilot availability changed.' },
  });
  assert.equal(overridden.response.status, 200, JSON.stringify(overridden.data));
  assert.equal(overridden.data.assignment.copilot.id, outsider.id);
  const audit = await prisma.auditLog.findFirst({
    where: { entityType: 'Assignment', entityId: assignment.id, action: 'COPILOT_OVERRIDDEN' },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(audit.reason, 'Copilot availability changed.');
});

test('mobile mission actions are revision-guarded and idempotent across response-loss retries', async () => {
  let current = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  const acceptActionId = crypto.randomUUID();
  const acceptBody = { clientActionId: acceptActionId, action: 'ACCEPT', expectedRevision: current.revision };
  const concurrent = await Promise.all([
    request(`/api/mobile/v1/pilot/assignments/${assignment.id}/actions`, { method: 'POST', token: primaryToken, body: acceptBody }),
    request(`/api/mobile/v1/pilot/assignments/${assignment.id}/actions`, { method: 'POST', token: primaryToken, body: acceptBody }),
  ]);
  assert.ok(
    concurrent.every(({ response }) => response.status === 200),
    JSON.stringify(concurrent.map(({ response, data }) => ({ status: response.status, data }))),
  );
  assert.deepEqual(concurrent.map(({ data }) => data.receipt.outcome).sort(), ['ALREADY_APPLIED', 'APPLIED']);
  assert.equal(await prisma.auditLog.count({ where: { entityType: 'Assignment', entityId: assignment.id, action: 'PILOT_ACCEPTED' } }), 1);

  const inaccurate = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/location`, {
    method: 'POST', token: primaryToken,
    body: { latitude: 11.5003, longitude: 77.2003, accuracyMetres: 150, capturedAt: new Date().toISOString() },
  });
  assert.equal(inaccurate.response.status, 400);
  assert.equal(inaccurate.data.error.code, 'LOCATION_INVALID');

  const capturedAt = new Date();
  const location = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/location`, {
    method: 'POST', token: primaryToken,
    body: { latitude: 11.5003, longitude: 77.2003, accuracyMetres: 25, capturedAt: capturedAt.toISOString() },
  });
  assert.equal(location.response.status, 200, JSON.stringify(location.data));
  assert.equal(location.data.location.assignmentId, assignment.id);
  assert.equal(location.data.location.latitude, undefined);
  assert.equal(location.data.location.longitude, undefined);
  const locationAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Assignment', entityId: assignment.id, action: 'GPS_LOCATION_UPDATED' },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(JSON.stringify(locationAudit).includes('11.5003'), false);

  const tooSoon = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/location`, {
    method: 'POST', token: primaryToken,
    body: { latitude: 11.5004, longitude: 77.2004, accuracyMetres: 25, capturedAt: new Date(capturedAt.getTime() + 1000).toISOString() },
  });
  assert.equal(tooSoon.response.status, 429);
  assert.equal(tooSoon.data.error.code, 'RATE_LIMITED');

  const reused = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/actions`, {
    method: 'POST', token: primaryToken,
    body: { clientActionId: acceptActionId, action: 'START', expectedRevision: current.revision + 1 },
  });
  assert.equal(reused.response.status, 409);
  assert.equal(reused.data.error.code, 'VALIDATION_FAILED');

  current = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  const stale = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/actions`, {
    method: 'POST', token: primaryToken,
    body: { clientActionId: crypto.randomUUID(), action: 'START', expectedRevision: current.revision - 1 },
  });
  assert.equal(stale.response.status, 200);
  assert.equal(stale.data.receipt.outcome, 'CONFLICT');
  assert.equal(stale.data.receipt.resultingRevision, current.revision);

  const synchronized = await request('/api/mobile/v1/pilot/sync', {
    method: 'POST', token: primaryToken,
    body: {
      cursor: syncCursor,
      mutations: [
        { assignmentId: assignment.id, clientActionId: crypto.randomUUID(), action: 'START', expectedRevision: current.revision },
        { assignmentId: assignment.id, clientActionId: crypto.randomUUID(), action: 'COMPLETE', expectedRevision: current.revision + 1, actualAcreage: '4.25' },
      ],
    },
  });
  assert.equal(synchronized.response.status, 200, JSON.stringify(synchronized.data));
  assert.deepEqual(synchronized.data.mutationReceipts.map(({ outcome }) => outcome), ['APPLIED', 'APPLIED']);
  assert.equal(await prisma.mobileMutationReceipt.count({ where: { assignmentId: assignment.id } }), 4);
  const completed = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  assert.equal(completed.lastKnownLat, null);
  assert.equal(completed.lastKnownLng, null);
  assert.equal(completed.lastPingAt, null);
});

test('controlled issue reporting is idempotent, coordinate-free and visible to Fleet', async () => {
  const lead = await prisma.lead.create({
    data: {
      farmerName: 'P32 Issue Farmer', farmerPhone: '+919000000033', farmerAddress: 'P32 Issue Farm', acreage: 2,
      intakeChannel: 'MANUAL_SALES', status: 'PROCESSED', latitude: 11.5002, longitude: 77.2002, matchedCenterId: center.id,
    },
  });
  ids.leads.push(lead.id);
  const scheduled = await assignments.manualAssign({
    leadId: lead.id,
    pilotId: primary.id,
    droneId: drone.id,
    lmvId: lmv.id,
    serviceWindowStart: new Date(Date.now() + 48 * 60 * 60_000),
    serviceWindowEnd: new Date(Date.now() + 50 * 60 * 60_000),
    actorId: fleet.id,
  });
  ids.assignments.push(scheduled.assignment.id);
  const formed = await request(`/api/mobile/v1/pilot/assignments/${scheduled.assignment.id}/copilot`, {
    method: 'POST', token: primaryToken,
    body: { candidateId: outsider.id, expectedRevision: scheduled.assignment.revision },
  });
  assert.equal(formed.response.status, 200, JSON.stringify(formed.data));
  let revision = formed.data.assignment.revision;
  for (const action of ['ACCEPT', 'START']) {
    const result = await request(`/api/mobile/v1/pilot/assignments/${scheduled.assignment.id}/actions`, {
      method: 'POST', token: primaryToken,
      body: { clientActionId: crypto.randomUUID(), action, expectedRevision: revision },
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.receipt.outcome, 'APPLIED');
    revision = result.data.receipt.resultingRevision;
  }

  const coordinateLeak = await request(`/api/mobile/v1/pilot/assignments/${scheduled.assignment.id}/actions`, {
    method: 'POST', token: primaryToken,
    body: {
      clientActionId: crypto.randomUUID(), action: 'REPORT_ISSUE', expectedRevision: revision,
      issueCategory: 'DRONE_MALFUNCTION', issueNote: 'Stopped at 11.5001,77.2001',
    },
  });
  assert.equal(coordinateLeak.response.status, 400);
  assert.equal(coordinateLeak.data.error.code, 'ISSUE_REJECTED');

  const issueActionId = crypto.randomUUID();
  const issueBody = {
    clientActionId: issueActionId,
    action: 'REPORT_ISSUE',
    expectedRevision: revision,
    issueCategory: 'DRONE_MALFUNCTION',
    issueNote: 'Motor vibration exceeded the safe operating limit.',
  };
  const reported = await request(`/api/mobile/v1/pilot/assignments/${scheduled.assignment.id}/actions`, {
    method: 'POST', token: primaryToken, body: issueBody,
  });
  const replay = await request(`/api/mobile/v1/pilot/assignments/${scheduled.assignment.id}/actions`, {
    method: 'POST', token: primaryToken, body: issueBody,
  });
  assert.equal(reported.response.status, 200, JSON.stringify(reported.data));
  assert.equal(reported.data.receipt.outcome, 'APPLIED');
  assert.equal(replay.data.receipt.outcome, 'ALREADY_APPLIED');
  const stored = await prisma.assignment.findUnique({ where: { id: scheduled.assignment.id }, include: { lead: true } });
  assert.equal(stored.issueCategory, 'DRONE_MALFUNCTION');
  assert.equal(stored.lead.status, 'FLAGGED');
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'MAINTENANCE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'AVAILABLE');
  assert.equal(await prisma.auditLog.count({ where: { entityId: scheduled.assignment.id, action: 'MISSION_ISSUE_REPORTED' } }), 1);
  assert.ok(await prisma.notification.findFirst({ where: { leadId: lead.id, type: 'MISSION_FLAGGED' } }));
});

test('cursor sync returns bounded changes and a tombstone after assignment removal', async () => {
  const changedIds = new Set();
  let cursor = syncCursor;
  let drainedInitialFeed = false;
  for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
    const page = await request(`/api/mobile/v1/pilot/changes?limit=1&cursor=${encodeURIComponent(cursor)}`, { token: primaryToken });
    assert.equal(page.response.status, 200, JSON.stringify(page.data));
    for (const item of page.data.changedAssignments) changedIds.add(item.id);
    cursor = page.data.nextCursor;
    if (!page.data.changedAssignments.length && !page.data.removedAssignmentIds.length) {
      drainedInitialFeed = true;
      break;
    }
  }
  assert.equal(drainedInitialFeed, true, 'Initial Pilot change feed did not drain within the safety bound');
  assert.ok(changedIds.has(assignment.id));

  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: assignment.id } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.delete({ where: { id: assignment.id } });
  });
  const removed = await request(`/api/mobile/v1/pilot/changes?cursor=${encodeURIComponent(cursor)}`, { token: primaryToken });
  assert.equal(removed.response.status, 200, JSON.stringify(removed.data));
  assert.deepEqual(removed.data.removedAssignmentIds, [assignment.id]);
  assert.equal(removed.data.changedAssignments.length, 0);

  const invalid = await request('/api/mobile/v1/pilot/changes?cursor=not-a-cursor', { token: primaryToken });
  assert.equal(invalid.response.status, 400);

  const expiredCursor = Buffer.from(JSON.stringify({
    v: 1,
    at: new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString(),
    sequence: '0',
  })).toString('base64url');
  const fullResync = await request(`/api/mobile/v1/pilot/changes?cursor=${expiredCursor}`, { token: primaryToken });
  assert.equal(fullResync.response.status, 200);
  assert.equal(fullResync.data.fullResyncRequired, true);

  await prisma.mobileAssignmentChange.create({
    data: {
      userId: primary.id,
      assignmentId: crypto.randomUUID(),
      kind: 'REMOVED',
      changedAt: new Date(Date.now() - 31 * 24 * 60 * 60_000),
    },
  });
  assert.ok((await purgeExpired()).count >= 1);
});

test.after(async () => {
  await prisma.mobileSession.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.mobileMutationReceipt.deleteMany({ where: { installationId: { in: ids.installations } } });
  await prisma.mobileInstallation.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.mobileAssignmentChange.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.assignments, ...ids.leads] } } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});
