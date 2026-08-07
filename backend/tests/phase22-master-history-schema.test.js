const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

const runId = `${process.pid}-${Date.now()}`;
const ids = {
  users: [],
  centers: [],
  drones: [],
  customers: [],
  crops: [],
  languages: [],
  locations: [],
  farmLocations: [],
  leads: [],
};

let server;
let baseUrl;
let admin;
let center;

function authorization(user) {
  return {
    Authorization: `Bearer ${issueToken(user)}`,
    'Content-Type': 'application/json',
  };
}

async function request(path, user, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: authorization(user),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  [admin, center] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Phase 22 Admin',
        email: `phase22-admin-${runId}@example.test`,
        passwordHash: 'test-only',
        role: 'ADMIN',
      },
    }),
    prisma.operatingCenter.create({
      data: {
        name: `Phase 22 Centre ${runId}`,
        code: `P22-${runId}`,
        latitude: 11,
        longitude: 77,
        radiusKm: 50,
      },
    }),
  ]);
  ids.users.push(admin.id);
  ids.centers.push(center.id);
});

test('master relations and append-only histories preserve safe operational state', async () => {
  const [language, crop, location, customer] = await Promise.all([
    prisma.language.create({
      data: { code: `p${String(process.pid).slice(-4)}`, displayName: `Phase 22 Language ${runId}` },
    }),
    prisma.crop.create({
      data: {
        code: `p22-crop-${runId}`,
        displayName: `Phase 22 Crop ${runId}`,
        normalizedName: `phase22crop${runId.replace(/\D/g, '')}`,
      },
    }),
    prisma.location.create({
      data: {
        countryCode: 'IN',
        state: 'Synthetic State',
        district: 'Synthetic District',
        mandal: 'Synthetic Mandal',
        village: 'Synthetic Village',
        normalizedKey: `in|synthetic|${runId}`,
      },
    }),
    prisma.customer.create({
      data: {
        displayName: `Phase 22 Customer ${runId}`,
        phone: `+919${String(Date.now()).slice(-9)}`,
      },
    }),
  ]);
  ids.languages.push(language.id);
  ids.crops.push(crop.id);
  ids.locations.push(location.id);
  ids.customers.push(customer.id);

  const preference = await prisma.customerLanguagePreference.create({
    data: { customerId: customer.id, languageId: language.id, rank: 1, proficiency: 'PRIMARY' },
  });
  const farmLocation = await prisma.farmLocation.create({
    data: {
      customerId: customer.id,
      administrativeLocationId: location.id,
      source: 'STAFF_CAPTURED',
      plusCode: '7J3W+9C',
      latitude: '11.1234567',
      longitude: '77.1234567',
      verifiedAt: new Date(),
      verifiedByUserId: admin.id,
    },
  });
  ids.farmLocations.push(farmLocation.id);
  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      farmerName: customer.displayName,
      farmerPhone: customer.phone,
      farmLocationId: farmLocation.id,
      acreage: 2.5,
      acreageDecimal: '2.50',
      cropId: crop.id,
      cropType: crop.displayName,
      intakeChannel: 'MANUAL_SALES',
      status: 'NEW',
      matchedCenterId: center.id,
    },
  });
  ids.leads.push(lead.id);

  await prisma.customer.update({
    where: { id: customer.id },
    data: { displayName: `${customer.displayName} Updated`, totalAcres: 2.5 },
  });
  await prisma.lead.update({ where: { id: lead.id }, data: { status: 'PROCESSED' } });

  const [customerHistory, leadHistory] = await Promise.all([
    prisma.customerHistory.findMany({ where: { customerId: customer.id }, orderBy: { version: 'asc' } }),
    prisma.leadHistory.findMany({ where: { leadId: lead.id }, orderBy: { version: 'asc' } }),
  ]);
  assert.deepEqual(customerHistory.map((entry) => entry.eventType), ['CREATED', 'UPDATED']);
  assert.deepEqual(leadHistory.map((entry) => entry.eventType), ['CREATED', 'STATUS_CHANGED']);
  assert.equal(JSON.stringify(customerHistory).includes(customer.phone), false, 'history must not copy a customer phone value');
  assert.equal(preference.rank, 1);
  assert.equal(lead.cropId, crop.id);
  assert.equal(lead.farmLocationId, farmLocation.id);

  await assert.rejects(
    prisma.customerLanguagePreference.create({
      data: { customerId: customer.id, languageId: language.id, rank: 0, proficiency: 'BASIC' },
    }),
  );
});

test('drone API preserves canonical asset fields and omits no-op history events', async () => {
  const serialNumber = `PHASE22-DRONE-${runId}`;
  const created = await request('/api/drones/add', admin, {
    method: 'POST',
    body: {
      name: 'Phase 22 Drone',
      type: 'Hexacopter',
      model: 'XL10',
      serialNumber,
      homeCenterId: center.id,
      tankCapacity: 10,
      batteryCapacity: 22000,
      endurance: 25,
      certified: 'Yes',
      service: 'Spraying',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  ids.drones.push(created.data.drone.id);
  assert.equal(created.data.drone.serialNumber, serialNumber);
  assert.equal(created.data.drone.uin, null);
  assert.equal(created.data.drone.certified, true);
  assert.equal(created.data.drone.tankCapacity, 10);
  assert.equal(created.data.drone.tankCapacityLitres, 10);
  assert.equal(created.data.drone.batteryCapacity, 22000);
  assert.equal(created.data.drone.batteryCapacityMah, 22000);
  assert.equal(created.data.drone.endurance, 25);
  assert.equal(created.data.drone.enduranceMinutes, 25);
  assert.equal(created.data.drone.operationalState, 'IN_SERVICE');
  assert.equal(created.data.drone.availabilityState, 'AVAILABLE');

  const updated = await request(`/api/drones/${created.data.drone.id}`, admin, {
    method: 'PATCH',
    body: { uin: `PHASE22-UIN-${runId}`, certified: 'No', endurance: 30 },
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.drone.certified, false);
  assert.equal(updated.data.drone.endurance, 30);
  assert.equal(updated.data.drone.enduranceMinutes, 30);

  const historyBeforeNoOp = await prisma.droneHistory.findMany({
    where: { droneId: created.data.drone.id },
    orderBy: { version: 'asc' },
  });
  assert.deepEqual(historyBeforeNoOp.map((entry) => entry.eventType), ['CREATED', 'UPDATED']);
  assert.deepEqual(
    {
      tankCapacityLitres: historyBeforeNoOp[0].changedFields.after.tankCapacityLitres,
      batteryCapacityMah: historyBeforeNoOp[0].changedFields.after.batteryCapacityMah,
      enduranceMinutes: historyBeforeNoOp[0].changedFields.after.enduranceMinutes,
    },
    { tankCapacityLitres: 10, batteryCapacityMah: 22000, enduranceMinutes: 25 },
  );
  assert.equal(historyBeforeNoOp[1].changedFields.before.enduranceMinutes, 25);
  assert.equal(historyBeforeNoOp[1].changedFields.after.enduranceMinutes, 30);

  await prisma.drone.update({
    where: { id: created.data.drone.id },
    data: { name: updated.data.drone.name },
  });
  assert.equal(
    await prisma.droneHistory.count({ where: { droneId: created.data.drone.id } }),
    historyBeforeNoOp.length,
    'writing an unchanged tracked value must not append a history event',
  );
});

test.after(async () => {
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.farmLocation.deleteMany({ where: { id: { in: ids.farmLocations } } });
  await prisma.customerLanguagePreference.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.crop.deleteMany({ where: { id: { in: ids.crops } } });
  await prisma.language.deleteMany({ where: { id: { in: ids.languages } } });
  await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.$disconnect();
  if (server) await new Promise((resolve) => server.close(resolve));
});
