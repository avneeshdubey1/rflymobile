const { PrismaClient } = require('@prisma/client');
const { hashPassword, validatePassword } = require('../services/passwordService');

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.otpDeliveryOutbox.deleteMany();
  await prisma.verificationDeliveryAttempt.deleteMany();
  await prisma.phoneVerificationChallenge.deleteMany();
  await prisma.passwordRecoveryChallenge.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.declinedEnquiry.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.scheduleChangeLog.deleteMany();
  await prisma.notificationEscalation.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.businessMembership.deleteMany();
  await prisma.businessOrganization.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.drone.deleteMany();
  await prisma.lMV.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pricingConfig.deleteMany();
  await prisma.operatingCenter.deleteMany();
}

async function main() {
  console.log('Seeding database...');
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  validatePassword(demoPassword);
  await clearDatabase();

  const tenkasi = await prisma.operatingCenter.create({
    data: { name: 'Tenkasi HQ', latitude: 8.959, longitude: 77.311, radiusKm: 50 },
  });
  const kanyakumari = await prisma.operatingCenter.create({
    data: { name: 'Kanyakumari Branch', latitude: 8.088, longitude: 77.538, radiusKm: 50 },
  });
  const srivilliputur = await prisma.operatingCenter.create({
    data: { name: 'Srivilliputur Branch', latitude: 9.5167, longitude: 77.6333, radiusKm: 50 },
  });

  const userPasswordHashes = await Promise.all(Array.from({ length: 8 }, () => hashPassword(demoPassword)));
  const provisionedAt = new Date();
  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[0], role: 'ADMIN' },
  });
  await prisma.user.createMany({
    data: [
      { name: 'Sales One', email: 'sales1@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[1], role: 'SALES' },
      { name: 'Sales Two', email: 'sales2@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[2], role: 'SALES' },
      { name: 'Fleet Manager 1', email: 'fleet1@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[3], role: 'FLEET_MANAGER' },
      { name: 'Fleet Manager 2', email: 'fleet2@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[4], role: 'FLEET_MANAGER' },
    ],
  });
  const pilot1 = await prisma.user.create({ data: { name: 'Pilot One', email: 'pilot1@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[5], role: 'PILOT', homeCenterId: tenkasi.id, pilotLicenseExpiry: new Date('2027-01-01') } });
  const pilot2 = await prisma.user.create({ data: { name: 'Pilot Two', email: 'pilot2@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[6], role: 'PILOT', homeCenterId: kanyakumari.id, pilotLicenseExpiry: new Date('2027-01-01') } });
  await prisma.user.create({ data: { name: 'Pilot Three', email: 'pilot3@fieldops.example', emailVerifiedAt: provisionedAt, passwordHash: userPasswordHashes[7], role: 'PILOT', homeCenterId: tenkasi.id, pilotLicenseExpiry: new Date('2025-01-01') } });

  const drones = await Promise.all([
    prisma.drone.create({ data: { model: 'Agras T10', serialNumber: 'SN-001', homeCenterId: tenkasi.id, status: 'ASSIGNED', airworthinessExpiry: new Date('2027-01-01') } }),
    prisma.drone.create({ data: { model: 'Agras T20', serialNumber: 'SN-002', homeCenterId: tenkasi.id, status: 'AVAILABLE', airworthinessExpiry: new Date('2027-01-01') } }),
    prisma.drone.create({ data: { model: 'Agras T10', serialNumber: 'SN-003', homeCenterId: kanyakumari.id, status: 'AVAILABLE', airworthinessExpiry: new Date('2027-01-01') } }),
    prisma.drone.create({ data: { model: 'Agras T30', serialNumber: 'SN-004', homeCenterId: kanyakumari.id, status: 'MAINTENANCE', airworthinessExpiry: new Date('2027-01-01') } }),
    prisma.drone.create({ data: { model: 'Agras T20', serialNumber: 'SN-005', homeCenterId: tenkasi.id, status: 'OUT_OF_SERVICE', airworthinessExpiry: new Date('2025-01-01') } }),
  ]);
  const lmvs = await Promise.all([
    prisma.lMV.create({ data: { registrationNo: 'TN-72-LMV-001', label: 'Tenkasi LMV 1', homeCenterId: tenkasi.id, status: 'ASSIGNED', capacity: 1 } }),
    prisma.lMV.create({ data: { registrationNo: 'TN-72-LMV-002', label: 'Tenkasi LMV 2', homeCenterId: tenkasi.id, status: 'AVAILABLE', capacity: 1 } }),
    prisma.lMV.create({ data: { registrationNo: 'TN-74-LMV-001', label: 'Kanyakumari LMV 1', homeCenterId: kanyakumari.id, status: 'AVAILABLE', capacity: 1 } }),
  ]);

  const statusRows = [
    ['NEW', 'WEBSITE'], ['MANUAL_CALL_REQUIRED', 'WEBSITE'], ['PROCESSED', 'MANUAL_SALES'],
    ['NEEDS_MANUAL_SCHEDULING', 'WEBSITE'], ['SCHEDULED', 'MANUAL_SALES'], ['PILOT_ACCEPTED', 'WEBSITE'],
    ['IN_PROGRESS', 'MANUAL_SALES'], ['COMPLETED', 'MANUAL_SALES'], ['FLAGGED', 'WEBSITE'],
    ['CANCELLED', 'WEBSITE'], ['REJECTED', 'MANUAL_SALES'],
  ];
  const leads = {};
  for (const [status, intakeChannel] of statusRows) {
    leads[status] = await prisma.lead.create({
      data: {
        farmerName: `Sample ${status}`, farmerPhone: `900000${String(Object.keys(leads).length).padStart(4, '0')}`,
        acreage: 5, status, intakeChannel,
        latitude: tenkasi.latitude,
        longitude: tenkasi.longitude,
        matchedCenterId: tenkasi.id,
        distanceFromCenterKm: 0,
      },
    });
  }
  for (const status of ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS', 'COMPLETED']) {
    await prisma.assignment.create({
      data: {
        leadId: leads[status].id, pilotId: pilot1.id, copilotId: pilot2.id, droneId: drones[0].id, lmvId: lmvs[0].id, scheduledDate: new Date('2026-07-20'), expectedAcreage: 5,
        acceptedAt: status === 'PILOT_ACCEPTED' || status === 'IN_PROGRESS' || status === 'COMPLETED' ? new Date('2026-07-19') : null,
        startedAt: status === 'IN_PROGRESS' || status === 'COMPLETED' ? new Date('2026-07-20T09:00:00Z') : null,
        completedAt: status === 'COMPLETED' ? new Date('2026-07-20T10:00:00Z') : null,
        actualAcreage: status === 'COMPLETED' ? 5 : null,
      },
    });
  }

  await prisma.pricingConfig.createMany({ data: [
    { key: 'DISCREPANCY_THRESHOLD_PCT', value: 5 },
    { key: 'WIND_THRESHOLD_KPH', value: 15 }, { key: 'RAIN_PROBABILITY_THRESHOLD_PCT', value: 40 },
    { key: 'PILOT_LICENSE_GRACE_DAYS', value: 14 }, { key: 'SPRAY_RATE_PER_ACRE', value: 1 }, // Development placeholder only; replace with approved commercial rate.
    { key: 'MAX_LEAD_ACREAGE', value: 10000 }, // Development validation placeholder; company must approve the operational limit.
  ] });
  console.log('Seeding completed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
