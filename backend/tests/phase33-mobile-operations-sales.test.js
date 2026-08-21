const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');

const runId = `${process.pid}-${Date.now()}`;
const password = 'phase33-password-strong';
const ids = { users: [], centers: [], crops: [], customers: [], leads: [], enquiries: [], installations: [], pricing: [] };
let server;
let baseUrl;
let center;
let crop;
let sales;
let fleet;
let admin;
let pilot;
let salesToken;
let fleetToken;
let adminToken;
let pilotToken;
let customerId;

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

async function login(user, route = 'operations') {
  const result = await request(`/api/mobile/v1/${route}/auth/login`, {
    method: 'POST',
    body: {
      email: user.email,
      password,
      installationKey: crypto.randomBytes(48).toString('base64url'),
      platform: 'ANDROID',
      appVersion: '1.0.0',
      deviceLabel: 'Phase 33 synthetic device',
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
  const maximum = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  if (!maximum) {
    const created = await prisma.pricingConfig.create({ data: { key: 'MAX_LEAD_ACREAGE', value: 100 } });
    ids.pricing.push(created.id);
  }
  center = await prisma.operatingCenter.create({
    data: { name: `Phase 33 Centre ${runId}`, code: `P33-${runId}`, latitude: 11.5, longitude: 77.2, radiusKm: 20 },
  });
  ids.centers.push(center.id);
  crop = await prisma.crop.create({
    data: {
      code: `phase33-${process.pid}`,
      displayName: `Phase 33 crop ${process.pid}`,
      normalizedName: `phase33crop${process.pid}`,
      active: true,
    },
  });
  ids.crops.push(crop.id);
  const passwordHash = await hashPassword(password);
  [sales, fleet, admin, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'P33 Sales', email: `p33-sales-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'P33 Fleet', email: `p33-fleet-${runId}@example.test`, passwordHash, role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'P33 Admin', email: `p33-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'P33 Pilot', email: `p33-pilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(sales.id, fleet.id, admin.id, pilot.id);
  [salesToken, fleetToken, adminToken, pilotToken] = await Promise.all([
    login(sales), login(fleet), login(admin), login(pilot, 'pilot'),
  ]);
});

test('Operations bootstrap advertises explicit role capabilities', async () => {
  const [salesBootstrap, fleetBootstrap] = await Promise.all([
    request('/api/mobile/v1/operations/bootstrap', { token: salesToken }),
    request('/api/mobile/v1/operations/bootstrap', { token: fleetToken }),
  ]);
  assert.equal(salesBootstrap.response.status, 200, JSON.stringify(salesBootstrap.data));
  assert.equal(fleetBootstrap.response.status, 200, JSON.stringify(fleetBootstrap.data));
  assert.equal(salesBootstrap.data.capabilities.includes('CUSTOMER_READ'), true);
  assert.equal(salesBootstrap.data.capabilities.includes('SALES_INTAKE'), true);
  assert.equal(fleetBootstrap.data.capabilities.includes('CUSTOMER_READ'), true);
  assert.equal(fleetBootstrap.data.capabilities.includes('SALES_INTAKE'), false);
});

test('mobile Sales registration and phone lookup normalize identity and expose a minimum DTO', async () => {
  const created = await request('/api/mobile/v1/operations/sales/customers', {
    method: 'POST',
    token: salesToken,
    body: {
      displayName: 'Phase 33 Farmer',
      phone: '9000000033',
      preferredLanguage: 'ta',
      ownership: 'OWNER',
      totalAcres: 7.5,
      village: 'Phase Village',
      district: 'Phase District',
      state: 'Tamil Nadu',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  customerId = created.data.customer.id;
  ids.customers.push(customerId);
  assert.equal(created.data.customer.phone, '+919000000033');
  assert.equal(created.data.customer.totalAcres, '7.5');
  assert.deepEqual(Object.keys(created.data.customer).sort(), [
    'displayName', 'id', 'location', 'ownership', 'phone', 'preferredLanguage', 'recentLeads', 'totalAcres',
  ]);
  assert.equal(JSON.stringify(created.data).match(/remarks|subscription|farmerPortalUserId|passwordHash/i), null);

  const lookup = await request('/api/mobile/v1/operations/sales/customers/by-phone?phone=9000000033', { token: fleetToken });
  assert.equal(lookup.response.status, 200, JSON.stringify(lookup.data));
  assert.equal(lookup.data.customer.id, customerId);

  const duplicate = await request('/api/mobile/v1/operations/sales/customers', {
    method: 'POST', token: adminToken, body: { displayName: 'Ignored duplicate', phone: '+91 90000 00033' },
  });
  assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.data));
  assert.equal(duplicate.data.created, false);
  assert.equal(duplicate.data.customer.id, customerId);

  const fleetDenied = await request('/api/mobile/v1/operations/sales/customers', {
    method: 'POST', token: fleetToken, body: { displayName: 'Denied', phone: '9000000034' },
  });
  assert.equal(fleetDenied.response.status, 403);
  assert.equal(fleetDenied.data.error.code, 'ROLE_NOT_ALLOWED');
  const pilotDenied = await request('/api/mobile/v1/operations/sales/customers?q=Phase', { token: pilotToken });
  assert.equal(pilotDenied.response.status, 403);
});

test('mobile Sales lead intake preserves strict body, crop and geofence rules', async () => {
  const unexpected = await request(`/api/mobile/v1/operations/sales/customers/${customerId}/leads`, {
    method: 'POST', token: salesToken, body: { acreage: 2, latitude: 11.5, longitude: 77.2, cropType: crop.displayName, actorId: admin.id },
  });
  assert.equal(unexpected.response.status, 400);
  assert.equal(unexpected.data.error.code, 'VALIDATION_FAILED');

  const accepted = await request(`/api/mobile/v1/operations/sales/customers/${customerId}/leads`, {
    method: 'POST',
    token: salesToken,
    body: { acreage: 2.25, latitude: 11.5, longitude: 77.2, cropType: crop.displayName, farmerAddress: 'Approved service farm' },
  });
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.data));
  assert.equal(accepted.data.outcome, 'ACCEPTED');
  ids.leads.push(accepted.data.lead.id);
  assert.equal(accepted.data.lead.acreage, '2.25');
  assert.equal(accepted.data.lead.operatingCenterId, center.id);
  assert.equal(JSON.stringify(accepted.data).match(/latitude|longitude|farmerPhone|distanceFromCenter/i), null);
  const stored = await prisma.lead.findUnique({ where: { id: accepted.data.lead.id } });
  assert.equal(stored.customerId, customerId);
  assert.equal(stored.farmerPhone, '+919000000033');
  assert.equal(stored.intakeChannel, 'MANUAL_SALES');

  const before = await prisma.lead.count();
  const declined = await request(`/api/mobile/v1/operations/sales/customers/${customerId}/leads`, {
    method: 'POST', token: adminToken, body: { acreage: 3, latitude: 14.5, longitude: 77.2, cropType: crop.displayName },
  });
  assert.equal(declined.response.status, 422, JSON.stringify(declined.data));
  assert.equal(declined.data.error.code, 'OUTSIDE_SERVICE_AREA');
  assert.equal(await prisma.lead.count(), before);
  const enquiry = await prisma.declinedEnquiry.findFirst({ where: { contactPhone: '+919000000033' }, orderBy: { createdAt: 'desc' } });
  assert.ok(enquiry);
  ids.enquiries.push(enquiry.id);
});

test.after(async () => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    const assignments = await transaction.assignment.findMany({ where: { leadId: { in: ids.leads } }, select: { id: true, droneId: true, lmvId: true } });
    const assignmentIds = assignments.map((assignment) => assignment.id);
    await transaction.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await transaction.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
    await transaction.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await transaction.auditLog.deleteMany({ where: { OR: [
      { entityType: 'Lead', entityId: { in: ids.leads } },
      { entityType: 'Customer', entityId: { in: ids.customers } },
      { entityType: 'DeclinedEnquiry', entityId: { in: ids.enquiries } },
      { entityType: 'MobileSession' },
      { entityType: 'MobileInstallation' },
    ] } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.declinedEnquiry.deleteMany({ where: { id: { in: ids.enquiries } } });
    await transaction.customer.deleteMany({ where: { id: { in: ids.customers } } });
    await transaction.mobileSession.deleteMany({ where: { installationId: { in: ids.installations } } });
    await transaction.mobileInstallation.deleteMany({ where: { id: { in: ids.installations } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.crop.deleteMany({ where: { id: { in: ids.crops } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
    await transaction.pricingConfig.deleteMany({ where: { id: { in: ids.pricing } } });
  });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
