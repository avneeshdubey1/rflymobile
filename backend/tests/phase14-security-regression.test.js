const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const { hashPassword } = require('../services/passwordService');

let server;
let baseUrl;
let admin;
let sales;
let pilot;
let drone;
let center;
let createdUserId;
let createdMaximumConfig = false;
const testPassword = crypto.randomBytes(24).toString('base64url');
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const passwordHash = await hashPassword(testPassword);
  center = await prisma.operatingCenter.create({ data: { name: `Security Centre ${runId}`, latitude: 8.959, longitude: 77.311, radiusKm: 50 } });
  [admin, sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Security Admin', email: `security-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Security Sales', email: `security-sales-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Security Pilot', email: `security-pilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
  ]);
  drone = await prisma.drone.create({ data: { model: 'Security Test', serialNumber: `SECURITY-${runId}`, status: 'AVAILABLE', homeCenterId: center.id } });
  const maximum = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  if (!maximum) {
    await prisma.pricingConfig.create({ data: { key: 'MAX_LEAD_ACREAGE', value: 10000 } });
    createdMaximumConfig = true;
  }
});

test('management APIs reject anonymous and wrong-role callers', async () => {
  const [anonymousUsers, anonymousDrones, anonymousAdd, anonymousStatus] = await Promise.all([
    request('/api/users/all'),
    request('/api/drones/all'),
    request('/api/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }),
    request('/api/drones/update-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ droneId: drone.id, status: 'MAINTENANCE' }) }),
  ]);
  assert.deepEqual([anonymousUsers.response.status, anonymousDrones.response.status, anonymousAdd.response.status, anonymousStatus.response.status], [401, 401, 401, 401]);

  const [salesUsers, pilotStatus, salesAdd] = await Promise.all([
    request('/api/users/all', { headers: auth(sales) }),
    request('/api/drones/update-status', { method: 'POST', headers: auth(pilot), body: JSON.stringify({ droneId: drone.id, status: 'MAINTENANCE' }) }),
    request('/api/users/add', { method: 'POST', headers: auth(sales), body: JSON.stringify({}) }),
  ]);
  assert.deepEqual([salesUsers.response.status, pilotStatus.response.status, salesAdd.response.status], [403, 403, 403]);
});

test('Admin account creation hashes the password and no API response exposes credential fields', async () => {
  const newPassword = crypto.randomBytes(24).toString('base64url');
  const created = await request('/api/users/add', {
    method: 'POST',
    headers: auth(admin),
    body: JSON.stringify({ name: 'Security Created User', email: `security-created-${runId}@example.test`, role: 'SALES', password: newPassword }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  createdUserId = created.data.user.id;
  assert.equal(JSON.stringify(created.data).includes('passwordHash'), false);
  const stored = await prisma.user.findUnique({ where: { id: createdUserId }, select: { passwordHash: true } });
  assert.match(stored.passwordHash, /^\$2[aby]\$/);
  assert.notEqual(stored.passwordHash, newPassword);

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: created.data.user.email, password: newPassword }),
  });
  assert.equal(login.response.status, 200);
  const listed = await request('/api/users/all', { headers: auth(admin) });
  const assignments = await request('/api/assignments/all', { headers: auth(admin) });
  assert.equal(JSON.stringify({ listed: listed.data, assignments: assignments.data }).includes('passwordHash'), false);
});

test('public intake rejects invalid phone and acreage before persistence', async () => {
  const before = await prisma.lead.count();
  const [phone, acreage] = await Promise.all([
    request('/api/leads/ingest/website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerName: 'Invalid Phone', phone: 'letters', acres: 2, latitude: 8.959, longitude: 77.311 }) }),
    request('/api/leads/ingest/website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerName: 'Invalid Acreage', phone: '9000012345', acres: -5, latitude: 8.959, longitude: 77.311 }) }),
  ]);
  assert.deepEqual([phone.response.status, acreage.response.status], [400, 400]);
  assert.equal(await prisma.lead.count(), before);
});

test.after(async () => {
  const userIds = [admin?.id, sales?.id, pilot?.id, createdUserId].filter(Boolean);
  await prisma.auditLog.deleteMany({ where: { entityType: 'User', entityId: { in: userIds } } });
  await prisma.drone.delete({ where: { id: drone.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.operatingCenter.delete({ where: { id: center.id } });
  if (createdMaximumConfig) await prisma.pricingConfig.delete({ where: { key: 'MAX_LEAD_ACREAGE' } });
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  await prisma.$disconnect();
});
