const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
let salesAuthorization;
let adminAuthorization;
let fleetAuthorization;
let farmerAuthorization;
let farmerUser;
let salesUserId;

const ids = {
  customers: [],
  leads: [],
  enquiries: [],
  users: [],
  centers: [],
  drones: [],
  lmvs: [],
  pricing: [],
};

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
  const maxAcreage = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  if (!maxAcreage) {
    const created = await prisma.pricingConfig.create({ data: { key: 'MAX_LEAD_ACREAGE', value: 100 } });
    ids.pricing.push(created.id);
  }
  const center = await prisma.operatingCenter.create({
    data: { name: 'Phase 16 Centre', latitude: 8.959, longitude: 77.311, radiusKm: 25 },
  });
  ids.centers.push(center.id);
  const [sales, admin, fleet, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 16 Sales', email: 'phase16-sales@example.test', passwordHash: 'test', role: 'SALES', emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { name: 'Phase 16 Admin', email: 'phase16-admin@example.test', passwordHash: 'test', role: 'ADMIN', emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { name: 'Phase 16 Fleet', email: 'phase16-fleet@example.test', passwordHash: 'test', role: 'FLEET_MANAGER', emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { name: 'Phase 16 Pilot', email: 'phase16-pilot@example.test', passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2027-01-01'), emailVerifiedAt: new Date() } }),
  ]);
  ids.users.push(sales.id, admin.id, fleet.id, pilot.id);
  const [drone, lmv] = await Promise.all([
    prisma.drone.create({ data: { model: 'Phase 16 Drone', serialNumber: `PHASE16-DRONE-${Date.now()}`, homeCenterId: center.id, status: 'AVAILABLE' } }),
    prisma.lMV.create({ data: { registrationNo: `PHASE16-LMV-${Date.now()}`, label: 'Phase 16 LMV', homeCenterId: center.id, status: 'AVAILABLE' } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  salesUserId = sales.id;
  salesAuthorization = `Bearer ${issueToken(sales)}`;
  adminAuthorization = `Bearer ${issueToken(admin)}`;
  fleetAuthorization = `Bearer ${issueToken(fleet)}`;
  farmerUser = await prisma.user.create({
    data: {
      name: 'Phase 16 Linked Farmer',
      email: 'phase16-linked-farmer@example.test',
      phone: '+919333333330',
      passwordHash: 'test',
      role: 'FARMER',
      preferredLanguage: 'en',
    },
  });
  ids.users.push(farmerUser.id);
  farmerAuthorization = `Bearer ${issueToken(farmerUser)}`;
});

test('Sales customer lookup APIs are denied to non-Sales roles', async () => {
  const anonymous = await request('/api/customers/sales');
  assert.equal(anonymous.response.status, 401);

  const fleet = await request('/api/customers/sales', { authorization: fleetAuthorization });
  assert.equal(fleet.response.status, 403);

  const farmer = await request('/api/customers/sales', { authorization: farmerAuthorization });
  assert.equal(farmer.response.status, 403);

  const deniedPortalEnable = await request('/api/customers/sales/missing/portal-access', { method: 'POST', authorization: fleetAuthorization });
  assert.equal(deniedPortalEnable.response.status, 403);
});

test('Sales can create and search staff-confirmed customers without issuing Farmer sessions', async () => {
  const created = await request('/api/customers/sales', {
    method: 'POST',
    authorization: salesAuthorization,
    body: {
      displayName: 'Phase 16 Phone Customer',
      phone: '9333333331',
      village: 'Phase Village',
      district: 'Phase District',
      preferredLanguage: 'ta',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.created, true);
  assert.equal(created.data.customer.displayName, 'Phase 16 Phone Customer');
  assert.equal(created.data.customer.hasFarmerPortalUser, false);
  assert.equal(Object.hasOwn(created.data.customer, 'passwordHash'), false);
  ids.customers.push(created.data.customer.id);

  const duplicate = await request('/api/customers/sales', {
    method: 'POST',
    authorization: salesAuthorization,
    body: { displayName: 'Duplicate Name Ignored', phone: '+919333333331' },
  });
  assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.data));
  assert.equal(duplicate.data.created, false);
  assert.equal(duplicate.data.customer.id, created.data.customer.id);

  const search = await request('/api/customers/sales?q=Phase%2016%20Phone', { authorization: salesAuthorization });
  assert.equal(search.response.status, 200, JSON.stringify(search.data));
  assert.equal(search.data.customers.some((customer) => customer.id === created.data.customer.id), true);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'Customer', entityId: created.data.customer.id } });
  assert.equal(audit.some((entry) => entry.action === 'SALES_CUSTOMER_CREATED'), true);
  assert.equal(JSON.stringify(audit).match(/9333333331|password|otp|latitude|longitude/i), null);
});

test('existing Farmer users are linked for Sales service view without impersonation', async () => {
  const linked = await request('/api/customers/sales', {
    method: 'POST',
    authorization: salesAuthorization,
    body: { displayName: 'Linked Name', phone: farmerUser.phone },
  });
  assert.equal(linked.response.status, 201, JSON.stringify(linked.data));
  assert.equal(linked.data.customer.displayName, 'Linked Name');
  assert.equal(linked.data.customer.hasFarmerPortalUser, true);
  ids.customers.push(linked.data.customer.id);

  const context = await request(`/api/customers/sales/${linked.data.customer.id}/service-context`, { authorization: salesAuthorization });
  assert.equal(context.response.status, 200, JSON.stringify(context.data));
  assert.equal(context.data.customer.id, linked.data.customer.id);
  assert.equal(context.data.customer.hasFarmerPortalUser, true);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'Customer', entityId: linked.data.customer.id } });
  assert.equal(audit.some((entry) => entry.action === 'SALES_SERVICE_VIEW_OPENED'), true);
  assert.equal(await prisma.authSession.count({ where: { userId: farmerUser.id, revokedAt: null } }), 0);
});

test('Sales can enable Farmer portal access without impersonating the farmer', async () => {
  const created = await request('/api/customers/sales', {
    method: 'POST',
    authorization: salesAuthorization,
    body: {
      displayName: 'Phase 16 Portal Enable',
      phone: '9333333333',
      village: 'Portal Village',
      district: 'Portal District',
      preferredLanguage: 'en',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  ids.customers.push(created.data.customer.id);

  const enabled = await request(`/api/customers/sales/${created.data.customer.id}/portal-access`, {
    method: 'POST',
    authorization: salesAuthorization,
  });
  assert.equal(enabled.response.status, 201, JSON.stringify(enabled.data));
  assert.equal(enabled.data.createdUser, true);
  assert.equal(enabled.data.customer.hasFarmerPortalUser, true);
  assert.ok(enabled.data.customer.farmerPortalUserId);
  assert.equal(Object.hasOwn(enabled.data.customer, 'passwordHash'), false);
  ids.users.push(enabled.data.customer.farmerPortalUserId);

  const farmer = await prisma.user.findUnique({ where: { id: enabled.data.customer.farmerPortalUserId } });
  assert.equal(farmer.role, 'FARMER');
  assert.equal(farmer.phone, '+919333333333');
  assert.equal(farmer.email, `farmer-${created.data.customer.id}@farmer.local`);
  assert.equal(farmer.phoneVerifiedAt, null);
  assert.equal(await prisma.authSession.count({ where: { userId: farmer.id, revokedAt: null } }), 0);

  const repeated = await request(`/api/customers/sales/${created.data.customer.id}/portal-access`, {
    method: 'POST',
    authorization: adminAuthorization,
  });
  assert.equal(repeated.response.status, 200, JSON.stringify(repeated.data));
  assert.equal(repeated.data.createdUser, false);
  assert.equal(repeated.data.customer.farmerPortalUserId, farmer.id);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'Customer', entityId: created.data.customer.id } });
  assert.equal(audit.some((entry) => entry.action === 'FARMER_PORTAL_USER_CREATED'), true);
  assert.equal(audit.some((entry) => entry.action === 'FARMER_PORTAL_USER_LINKED'), true);
  assert.equal(JSON.stringify(audit).match(/9333333333|password|otp|latitude|longitude/i), null);
});

test('portal access is refused when customer phone belongs to a non-Farmer account', async () => {
  const business = await prisma.user.create({
    data: {
      name: 'Phase 16 Phone Conflict',
      email: 'phase16-phone-conflict@example.test',
      phone: '+919333333334',
      passwordHash: 'test',
      role: 'BUSINESS',
      active: true,
    },
  });
  ids.users.push(business.id);
  const created = await request('/api/customers/sales', {
    method: 'POST',
    authorization: salesAuthorization,
    body: { displayName: 'Phase 16 Conflict Customer', phone: business.phone },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  ids.customers.push(created.data.customer.id);

  const enabled = await request(`/api/customers/sales/${created.data.customer.id}/portal-access`, {
    method: 'POST',
    authorization: salesAuthorization,
  });
  assert.equal(enabled.response.status, 409, JSON.stringify(enabled.data));
  assert.equal(enabled.data.code, 'PORTAL_PHONE_ACCOUNT_CONFLICT');
  const customer = await prisma.customer.findUnique({ where: { id: created.data.customer.id } });
  assert.equal(customer.farmerUserId, null);
});

test('Sales service view creates customer-linked manual leads and keeps strict geofence decline behavior', async () => {
  const created = await request('/api/customers/sales', {
    method: 'POST',
    authorization: adminAuthorization,
    body: { displayName: 'Phase 16 Service Farmer', phone: '9333333332', preferredLanguage: 'ml' },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  ids.customers.push(created.data.customer.id);

  const accepted = await request(`/api/customers/sales/${created.data.customer.id}/leads`, {
    method: 'POST',
    authorization: salesAuthorization,
    body: {
      acres: 2,
      cropType: 'Rice',
      village: 'In range service village',
      latitude: 8.959,
      longitude: 77.311,
    },
  });
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.data));
  assert.equal(accepted.data.outcome, 'ACCEPTED');
  ids.leads.push(accepted.data.lead.id);
  const stored = await prisma.lead.findUnique({ where: { id: accepted.data.lead.id } });
  assert.equal(stored.customerId, created.data.customer.id);
  assert.equal(stored.intakeChannel, 'MANUAL_SALES');
  assert.equal(stored.farmerName, 'Phase 16 Service Farmer');
  assert.equal(stored.farmerPhone, created.data.customer.phone);
  assert.equal(stored.preferredLanguage, 'ml');

  const beforeLeadCount = await prisma.lead.count();
  const declined = await request(`/api/customers/sales/${created.data.customer.id}/leads`, {
    method: 'POST',
    authorization: salesAuthorization,
    body: {
      acres: 2,
      cropType: 'Rice',
      village: 'Sensitive out-of-area address',
      latitude: 10,
      longitude: 77.311,
    },
  });
  assert.equal(declined.response.status, 422, JSON.stringify(declined.data));
  assert.equal(declined.data.code, 'OUTSIDE_SERVICE_AREA');
  assert.equal(await prisma.lead.count(), beforeLeadCount);

  const enquiry = await prisma.declinedEnquiry.findFirst({
    where: { contactPhone: created.data.customer.phone },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(enquiry);
  ids.enquiries.push(enquiry.id);
  assert.equal(enquiry.createdByUserId, salesUserId);
  assert.equal(enquiry.sourceChannel, 'MANUAL_SALES');
  assert.equal(JSON.stringify(declined.data).match(/Sensitive|latitude|longitude|distance|acreage/i), null);
});

test.after(async () => {
  const assignments = await prisma.assignment.findMany({ where: { leadId: { in: ids.leads } }, select: { id: true, droneId: true, lmvId: true } });
  const assignmentIds = assignments.map((assignment) => assignment.id);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.drone.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.droneId) } }, data: { status: 'AVAILABLE' } });
  await prisma.lMV.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.lmvId).filter(Boolean) } }, data: { status: 'AVAILABLE' } });
  await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: 'Lead', entityId: { in: ids.leads } },
        { entityType: 'DeclinedEnquiry', entityId: { in: ids.enquiries } },
        { entityType: 'Customer', entityId: { in: ids.customers } },
      ],
    },
  });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.declinedEnquiry.deleteMany({ where: { id: { in: ids.enquiries } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await prisma.pricingConfig.deleteMany({ where: { id: { in: ids.pricing } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
