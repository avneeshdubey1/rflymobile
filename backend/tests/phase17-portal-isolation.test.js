const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;

const ids = {
  users: [],
  customers: [],
  organizations: [],
  leads: [],
  centers: [],
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

async function createUser(data) {
  const user = await prisma.user.create({
    data: {
      passwordHash: 'test',
      emailVerifiedAt: new Date(),
      ...data,
    },
  });
  ids.users.push(user.id);
  return user;
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const maxAcreage = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  if (!maxAcreage) {
    const created = await prisma.pricingConfig.create({ data: { key: 'MAX_LEAD_ACREAGE', value: 100 } });
    ids.pricing.push(created.id);
  }
  const center = await prisma.operatingCenter.create({ data: { name: 'Phase 17 Centre', latitude: 8.959, longitude: 77.311, radiusKm: 25 } });
  ids.centers.push(center.id);
});

test('Farmer portal returns only the linked customer requests', async () => {
  const [farmerA, farmerB] = await Promise.all([
    createUser({ name: 'Phase 17 Farmer A', email: 'phase17-farmer-a@example.test', phone: '+919444444441', role: 'FARMER' }),
    createUser({ name: 'Phase 17 Farmer B', email: 'phase17-farmer-b@example.test', phone: '+919444444442', role: 'FARMER' }),
  ]);
  const [customerA, customerB] = await Promise.all([
    prisma.customer.create({ data: { displayName: 'Phase 17 Customer A', phone: farmerA.phone, farmerUserId: farmerA.id, preferredLanguage: 'en' } }),
    prisma.customer.create({ data: { displayName: 'Phase 17 Customer B', phone: farmerB.phone, farmerUserId: farmerB.id, preferredLanguage: 'en' } }),
  ]);
  ids.customers.push(customerA.id, customerB.id);
  const [leadA, leadB] = await Promise.all([
    prisma.lead.create({ data: { customerId: customerA.id, farmerName: customerA.displayName, farmerPhone: customerA.phone, acreage: 2, cropType: 'Rice', intakeChannel: 'MANUAL_SALES', status: 'SCHEDULED', matchedCenterId: ids.centers[0] } }),
    prisma.lead.create({ data: { customerId: customerB.id, farmerName: customerB.displayName, farmerPhone: customerB.phone, acreage: 3, cropType: 'Cotton', intakeChannel: 'MANUAL_SALES', status: 'COMPLETED', matchedCenterId: ids.centers[0] } }),
  ]);
  ids.leads.push(leadA.id, leadB.id);

  const farmerAResult = await request('/api/portal/farmer/summary', { authorization: `Bearer ${issueToken(farmerA)}` });
  assert.equal(farmerAResult.response.status, 200, JSON.stringify(farmerAResult.data));
  assert.deepEqual(farmerAResult.data.portal.leads.map((lead) => lead.id), [leadA.id]);
  assert.equal(JSON.stringify(farmerAResult.data).includes(leadB.id), false);
  assert.equal(farmerAResult.data.portal.totals.total, 1);
  assert.equal(farmerAResult.data.portal.totals.active, 1);
});

test('Farmer self-request remains available and becomes visible through the linked portal', async () => {
  const farmer = await createUser({ name: 'Phase 17 Self Farmer', email: 'phase17-self-farmer@example.test', phone: '+919444444443', role: 'FARMER', preferredLanguage: 'ml' });
  const created = await request('/api/leads/new', {
    method: 'POST',
    authorization: `Bearer ${issueToken(farmer)}`,
    body: { acres: 1.5, cropType: 'Banana', village: 'Phase 17 Village', district: 'Phase 17 District', latitude: 8.959, longitude: 77.311 },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  ids.leads.push(created.data.lead.id);
  const stored = await prisma.lead.findUnique({ where: { id: created.data.lead.id } });
  ids.customers.push(stored.customerId);
  assert.ok(stored.customerId);

  const portal = await request('/api/portal/farmer/summary', { authorization: `Bearer ${issueToken(farmer)}` });
  assert.equal(portal.response.status, 200, JSON.stringify(portal.data));
  assert.deepEqual(portal.data.portal.leads.map((lead) => lead.id), [created.data.lead.id]);
});

test('Business portal returns only explicitly linked organization work', async () => {
  const [businessA, businessB] = await Promise.all([
    createUser({ name: 'Phase 17 Business A', email: 'phase17-business-a@example.test', phone: '+919444444444', role: 'BUSINESS', active: true, businessName: 'Business A' }),
    createUser({ name: 'Phase 17 Business B', email: 'phase17-business-b@example.test', phone: '+919444444445', role: 'BUSINESS', active: true, businessName: 'Business B' }),
  ]);
  const [orgA, orgB] = await Promise.all([
    prisma.businessOrganization.create({ data: { name: 'Phase 17 Org A', active: true } }),
    prisma.businessOrganization.create({ data: { name: 'Phase 17 Org B', active: true } }),
  ]);
  ids.organizations.push(orgA.id, orgB.id);
  await Promise.all([
    prisma.businessMembership.create({ data: { organizationId: orgA.id, userId: businessA.id, active: true } }),
    prisma.businessMembership.create({ data: { organizationId: orgB.id, userId: businessB.id, active: true } }),
  ]);
  const [leadA, leadB] = await Promise.all([
    prisma.lead.create({ data: { businessOrganizationId: orgA.id, farmerName: 'Phase 17 Org A Farmer', farmerPhone: '+919444444446', acreage: 4, cropType: 'Rice', intakeChannel: 'MANUAL_SALES', status: 'IN_PROGRESS', matchedCenterId: ids.centers[0] } }),
    prisma.lead.create({ data: { businessOrganizationId: orgB.id, farmerName: 'Phase 17 Org B Farmer', farmerPhone: '+919444444447', acreage: 5, cropType: 'Cotton', intakeChannel: 'MANUAL_SALES', status: 'COMPLETED', matchedCenterId: ids.centers[0] } }),
  ]);
  ids.leads.push(leadA.id, leadB.id);

  const result = await request('/api/portal/business/summary', { authorization: `Bearer ${issueToken(businessA)}` });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data.portal.organizations.map((organization) => organization.id), [orgA.id]);
  assert.deepEqual(result.data.portal.organizations[0].leads.map((lead) => lead.id), [leadA.id]);
  assert.equal(JSON.stringify(result.data).includes(leadB.id), false);
  assert.equal(result.data.portal.totals.active, 1);
});

test('Portal routes reject anonymous and wrong-role callers', async () => {
  const sales = await createUser({ name: 'Phase 17 Sales', email: 'phase17-sales@example.test', role: 'SALES' });
  const farmer = await createUser({ name: 'Phase 17 Role Farmer', email: 'phase17-role-farmer@example.test', phone: '+919444444448', role: 'FARMER' });
  const business = await createUser({ name: 'Phase 17 Role Business', email: 'phase17-role-business@example.test', phone: '+919444444449', role: 'BUSINESS', active: true });

  assert.equal((await request('/api/portal/farmer/summary')).response.status, 401);
  assert.equal((await request('/api/portal/farmer/summary', { authorization: `Bearer ${sales && issueToken(sales)}` })).response.status, 403);
  assert.equal((await request('/api/portal/business/summary', { authorization: `Bearer ${farmer && issueToken(farmer)}` })).response.status, 403);
  assert.equal((await request('/api/customers/sales', { authorization: `Bearer ${business && issueToken(business)}` })).response.status, 403);
});

test.after(async () => {
  await prisma.paymentRecord.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.assignment.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.customers, ...ids.organizations] } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.businessMembership.deleteMany({ where: { organizationId: { in: ids.organizations } } });
  await prisma.businessOrganization.deleteMany({ where: { id: { in: ids.organizations } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers.filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await prisma.pricingConfig.deleteMany({ where: { id: { in: ids.pricing } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
