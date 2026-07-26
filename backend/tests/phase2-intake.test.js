const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { evaluate, haversineDistanceKm } = require('../services/geofenceService');
const { issueToken } = require('../middleware/auth');
const { RETENTION_DAYS, create: createDeclinedEnquiry, purgeExpired } = require('../services/declinedEnquiryService');

let server;
let baseUrl;
let salesAuthorization;
let adminAuthorization;
let farmerAuthorization;
let farmerUser;
const createdLeadIds = [];
const createdEnquiryIds = [];
const createdCenterIds = [];
const createdDroneIds = [];

async function request(pathname, { method = 'GET', body, authorization } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const [sales, admin] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'SALES' } }),
    prisma.user.findFirst({ where: { role: 'ADMIN' } }),
  ]);
  salesAuthorization = `Bearer ${issueToken(sales)}`;
  adminAuthorization = `Bearer ${issueToken(admin)}`;
  farmerUser = await prisma.user.create({
    data: {
      name: 'Phase 2 Farmer Identity',
      email: 'phase2-farmer@example.test',
      phone: '+919222222229',
      passwordHash: 'test',
      role: 'FARMER',
      preferredLanguage: 'ml',
    },
  });
  farmerAuthorization = `Bearer ${issueToken(farmerUser)}`;
});

test('Haversine distance returns zero for the same point', () => {
  assert.equal(haversineDistanceKm(8.959, 77.311, 8.959, 77.311), 0);
});

test('geofencing deterministically selects the nearest active matching centre', async () => {
  const [nearest, farther, inactive] = await Promise.all([
    prisma.operatingCenter.create({ data: { name: 'Phase 2 Nearest Centre', latitude: -20, longitude: -40, radiusKm: 10 } }),
    prisma.operatingCenter.create({ data: { name: 'Phase 2 Farther Centre', latitude: -20.02, longitude: -40.02, radiusKm: 10 } }),
    prisma.operatingCenter.create({ data: { name: 'Phase 2 Inactive Centre', latitude: -20, longitude: -40, radiusKm: 10, active: false } }),
  ]);
  createdCenterIds.push(nearest.id, farther.id, inactive.id);
  const result = await evaluate(-20, -40);
  assert.equal(result.matchedCenter.id, nearest.id);
  assert.equal(result.distanceKm, 0);
});

test('website intake creates an in-area Lead awaiting Sales review and ignores caller-controlled fields', async () => {
  const result = await request('/api/leads/ingest/website', {
    method: 'POST',
    body: {
      farmerName: 'Phase 2 In Range', phone: '9111111111', acres: 2, cropType: 'Rice', latitude: 8.959, longitude: 77.311,
      intakeChannel: 'MANUAL_SALES', matchedCenterId: 'forged-center', distanceFromCenterKm: 999, assignment: { create: {} }, preferredLanguage: 'ml',
    },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.outcome, 'ACCEPTED');
  assert.equal(result.data.lead.status, 'NEW');
  createdLeadIds.push(result.data.lead.id);
  const stored = await prisma.lead.findUnique({ where: { id: result.data.lead.id } });
  assert.equal(stored.intakeChannel, 'WEBSITE');
  assert.notEqual(stored.matchedCenterId, 'forged-center');
  assert.notEqual(stored.distanceFromCenterKm, 999);
  assert.equal(stored.preferredLanguage, 'ml');
  assert.equal(await prisma.assignment.count({ where: { leadId: stored.id } }), 0);
});

test('out-of-area website and phone Sales intake create only minimal declined enquiries', async () => {
  const before = {
    leads: await prisma.lead.count(),
    assignments: await prisma.assignment.count(),
    payments: await prisma.paymentRecord.count(),
    enquiries: await prisma.declinedEnquiry.count(),
  };
  const payload = { farmerName: 'Phase 2 Out Of Range', phone: '9222222222', acres: 2, cropType: 'Rice', village: 'Sensitive farm address', latitude: 10, longitude: 77.311 };
  const website = await request('/api/leads/ingest/website', { method: 'POST', body: payload });
  const manual = await request('/api/leads/ingest/manual', { method: 'POST', authorization: salesAuthorization, body: { ...payload, phone: '9222222223' } });
  for (const result of [website, manual]) {
    assert.equal(result.response.status, 422, JSON.stringify(result.data));
    assert.deepEqual(Object.keys(result.data).sort(), ['code', 'messageKey', 'outcome', 'success']);
    assert.equal(result.data.code, 'OUTSIDE_SERVICE_AREA');
    assert.equal(JSON.stringify(result.data).match(/latitude|longitude|distance|acreage|appeal|fee/i), null);
  }
  assert.equal(await prisma.lead.count(), before.leads);
  assert.equal(await prisma.assignment.count(), before.assignments);
  assert.equal(await prisma.paymentRecord.count(), before.payments);
  const enquiries = await prisma.declinedEnquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 2 });
  assert.equal(await prisma.declinedEnquiry.count(), before.enquiries + 2);
  createdEnquiryIds.push(...enquiries.map((enquiry) => enquiry.id));
  for (const enquiry of enquiries) {
    assert.deepEqual(Object.keys(enquiry).sort(), ['contactName', 'contactPhone', 'createdAt', 'createdByUserId', 'expiresAt', 'id', 'reason', 'sourceChannel']);
    assert.equal(enquiry.reason, 'OUTSIDE_SERVICE_AREA');
    assert.equal(enquiry.sourceChannel === 'WEBSITE' || enquiry.sourceChannel === 'MANUAL_SALES', true);
    assert.equal(enquiry.contactName, 'Phase 2 Out Of Range');
  }
  const audit = await prisma.auditLog.findMany({ where: { entityType: 'DeclinedEnquiry', entityId: { in: createdEnquiryIds } } });
  assert.equal(audit.length, 2);
  assert.equal(JSON.stringify(audit).match(/latitude|longitude|distance|acreage|sensitive farm/i), null);
});

test('authenticated Farmer intake binds the account identity and cannot bypass strict service-area validation', async () => {
  const accepted = await request('/api/leads/new', {
    method: 'POST',
    authorization: farmerAuthorization,
    body: {
      farmerName: 'Forged Farmer Name', phone: '9000000000', acres: 2, cropType: 'Rice', village: 'Farmer Village',
      latitude: 8.959, longitude: 77.311, preferredLanguage: 'en', intakeChannel: 'MANUAL_SALES',
    },
  });
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.data));
  createdLeadIds.push(accepted.data.lead.id);
  const stored = await prisma.lead.findUnique({ where: { id: accepted.data.lead.id } });
  assert.equal(stored.farmerName, farmerUser.name);
  assert.equal(stored.farmerPhone, farmerUser.phone);
  assert.equal(stored.preferredLanguage, 'ml');
  assert.equal(stored.intakeChannel, 'WEBSITE');

  const beforeLeadCount = await prisma.lead.count();
  const beforeEnquiryCount = await prisma.declinedEnquiry.count();
  const declined = await request('/api/leads/new', {
    method: 'POST',
    authorization: farmerAuthorization,
    body: { acres: 2, cropType: 'Rice', village: 'Sensitive farmer address', latitude: 10, longitude: 77.311 },
  });
  assert.equal(declined.response.status, 422, JSON.stringify(declined.data));
  assert.equal(declined.data.code, 'OUTSIDE_SERVICE_AREA');
  assert.equal(await prisma.lead.count(), beforeLeadCount);
  assert.equal(await prisma.declinedEnquiry.count(), beforeEnquiryCount + 1);
  const enquiry = await prisma.declinedEnquiry.findFirst({ where: { contactPhone: farmerUser.phone }, orderBy: { createdAt: 'desc' } });
  createdEnquiryIds.push(enquiry.id);
  assert.equal(enquiry.createdByUserId, farmerUser.id);
  assert.equal(enquiry.sourceChannel, 'WEBSITE');
});

test('missing coordinates are rejected before a declined enquiry or Lead is created', async () => {
  const before = {
    leads: await prisma.lead.count(),
    enquiries: await prisma.declinedEnquiry.count(),
  };
  const result = await request('/api/leads/ingest/website', {
    method: 'POST',
    body: { farmerName: 'No Coordinates', phone: '9222222227', acres: 2, cropType: 'Rice', latitude: '', longitude: '' },
  });
  assert.equal(result.response.status, 400, JSON.stringify(result.data));
  assert.equal(result.data.code, 'LOCATION_REQUIRED');
  assert.equal(await prisma.lead.count(), before.leads);
  assert.equal(await prisma.declinedEnquiry.count(), before.enquiries);
});

test('declined enquiry purge removes expired rows idempotently at the 30-day boundary', async () => {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const expired = await prisma.declinedEnquiry.create({
    data: { contactName: 'Purge Boundary', contactPhone: '+919222222224', sourceChannel: 'WEBSITE', expiresAt: now },
  });
  const retained = await prisma.declinedEnquiry.create({
    data: { contactName: 'Purge Retained', contactPhone: '+919222222225', sourceChannel: 'WEBSITE', expiresAt: new Date(now.getTime() + 1) },
  });
  createdEnquiryIds.push(retained.id);
  const first = await purgeExpired({ now });
  const second = await purgeExpired({ now });
  assert.equal(first.count >= 1, true);
  assert.equal(second.count, 0);
  assert.equal(await prisma.declinedEnquiry.findUnique({ where: { id: expired.id } }), null);
  assert.ok(await prisma.declinedEnquiry.findUnique({ where: { id: retained.id } }));
});

test('declined enquiries always use the fixed approved 30-day retention period', async () => {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const enquiry = await createDeclinedEnquiry({
    contactName: 'Fixed Retention',
    contactPhone: '+919222222223',
    sourceChannel: 'WEBSITE',
    now,
  });
  createdEnquiryIds.push(enquiry.id);
  assert.equal(RETENTION_DAYS, 30);
  assert.equal(enquiry.expiresAt.toISOString(), new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString());
});

test('legacy records cannot bypass service-area revalidation and retired routes stay unavailable', async () => {
  const legacy = await prisma.lead.create({
    data: { farmerName: 'Phase 2 Legacy', farmerPhone: '+919222222226', acreage: 1, intakeChannel: 'WEBSITE', status: 'NEW', latitude: 10, longitude: 77.311 },
  });
  createdLeadIds.push(legacy.id);
  const process = await request('/api/leads/process', { method: 'POST', authorization: salesAuthorization, body: { id: legacy.id } });
  assert.equal(process.response.status, 409);
  assert.equal(process.data.code, 'SERVICE_AREA_REVALIDATION_FAILED');

  const processedLegacy = await prisma.lead.create({
    data: { farmerName: 'Phase 2 Legacy Processed', farmerPhone: '+919222222228', acreage: 1, intakeChannel: 'MANUAL_SALES', status: 'PROCESSED', latitude: 10, longitude: 77.311 },
  });
  createdLeadIds.push(processedLegacy.id);
  const autoAssign = await request(`/api/leads/${processedLegacy.id}/auto-assign`, { method: 'POST', authorization: adminAuthorization });
  assert.equal(autoAssign.response.status, 409, JSON.stringify(autoAssign.data));
  assert.equal(autoAssign.data.code, 'SERVICE_AREA_REVALIDATION_FAILED');
  const [pilot, drone] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'PILOT' } }),
    prisma.drone.findFirst(),
  ]);
  const manualAssign = await request('/api/assignments/manual', {
    method: 'POST',
    authorization: adminAuthorization,
    body: { leadId: processedLegacy.id, pilotId: pilot.id, droneId: drone.id },
  });
  assert.equal(manualAssign.response.status, 409, JSON.stringify(manualAssign.data));
  assert.equal(manualAssign.data.code, 'SERVICE_AREA_REVALIDATION_FAILED');

  const activeCenter = await prisma.operatingCenter.findFirst({ where: { active: true } });
  assert.ok(activeCenter, 'An active operating centre is required for the reschedule fixture');
  const rescheduleDrone = await prisma.drone.create({
    data: {
      model: 'Phase 2 Reschedule Drone',
      serialNumber: `phase2-reschedule-${Date.now()}`,
      homeCenterId: activeCenter.id,
      status: 'AVAILABLE',
    },
  });
  createdDroneIds.push(rescheduleDrone.id);
  const scheduledLegacy = await prisma.lead.create({
    data: { farmerName: 'Phase 2 Legacy Scheduled', farmerPhone: '+919222222227', acreage: 1, intakeChannel: 'WEBSITE', status: 'SCHEDULED', latitude: 10, longitude: 77.311 },
  });
  createdLeadIds.push(scheduledLegacy.id);
  const legacyAssignment = await prisma.assignment.create({
    data: { leadId: scheduledLegacy.id, pilotId: pilot.id, droneId: rescheduleDrone.id, scheduledDate: new Date('2026-08-01T09:00:00.000Z'), expectedAcreage: 1, autoAssigned: false },
  });
  const reschedule = await request(`/api/assignments/${legacyAssignment.id}/reschedule`, {
    method: 'PUT',
    authorization: adminAuthorization,
    body: { scheduledDate: '2026-08-02T09:00:00.000Z', reason: 'Must not bypass service area' },
  });
  assert.equal(reschedule.response.status, 409, JSON.stringify(reschedule.data));
  assert.equal(reschedule.data.code, 'SERVICE_AREA_REVALIDATION_FAILED');

  const [google, form, appeal] = await Promise.all([
    request('/api/leads/ingest/google-form', { method: 'POST', body: {} }),
    request('/api/forms/webhook', { method: 'POST', body: {} }),
    request(`/api/leads/${legacy.id}/appeal`, { method: 'POST', body: {} }),
  ]);
  assert.deepEqual([google.response.status, form.response.status, appeal.response.status], [404, 404, 404]);
});

test.after(async () => {
  const assignments = await prisma.assignment.findMany({ where: { leadId: { in: createdLeadIds } }, select: { id: true, droneId: true } });
  const assignmentIds = assignments.map((assignment) => assignment.id);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.drone.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.droneId) } }, data: { status: 'AVAILABLE' } });
  await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityType: 'Lead', entityId: { in: createdLeadIds } }, { entityType: 'DeclinedEnquiry', entityId: { in: createdEnquiryIds } }] } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.declinedEnquiry.deleteMany({ where: { id: { in: createdEnquiryIds } } });
  await prisma.drone.deleteMany({ where: { id: { in: createdDroneIds } } });
  await prisma.user.delete({ where: { id: farmerUser.id } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: createdCenterIds } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
