const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const customerService = require('../services/customerService');
const intakeService = require('../services/intakeService');
const leadRepository = require('../src/repositories/leadRepository');
const normalizedCompatibilityRepository = require('../src/repositories/normalizedCompatibilityRepository');

const runId = `${process.pid}-${Date.now()}`;
const ids = {
  users: [],
  centers: [],
  customers: [],
  leads: [],
  locations: [],
  languages: [],
  crops: [],
  pricing: [],
};

let actor;
let center;
let activeCrop;
let inactiveCrop;
let replacementCrop;
let customer;

test.before(async () => {
  const maximumAcreage = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  if (!maximumAcreage) {
    const created = await prisma.pricingConfig.create({ data: { key: 'MAX_LEAD_ACREAGE', value: 100 } });
    ids.pricing.push(created.id);
  }

  [actor, center] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Phase 23 Maintainer',
        email: `phase23-${runId}@example.test`,
        passwordHash: 'test-only',
        role: 'ADMIN',
      },
    }),
    prisma.operatingCenter.create({
      data: {
        name: `Phase 23 Centre ${runId}`,
        code: `P23-${runId}`,
        latitude: 11.1234567,
        longitude: 77.1234567,
        radiusKm: 20,
      },
    }),
  ]);
  ids.users.push(actor.id);
  ids.centers.push(center.id);

  const [english, tamil, inactiveLanguage, approvedCrop, disabledCrop, secondApprovedCrop] = await Promise.all([
    prisma.language.findUniqueOrThrow({ where: { code: 'en' } }),
    prisma.language.findUniqueOrThrow({ where: { code: 'ta' } }),
    prisma.language.update({ where: { code: 'ml' }, data: { active: false } }),
    prisma.crop.create({
      data: {
        code: `p23-rice-${runId}`,
        displayName: `Phase 23 Rice ${runId}`,
        normalizedName: `phase23rice${runId}`,
        active: true,
      },
    }),
    prisma.crop.create({
      data: {
        code: `p23-disabled-${runId}`,
        displayName: `Phase 23 Disabled ${runId}`,
        normalizedName: `phase23disabled${runId}`,
        active: false,
      },
    }),
    prisma.crop.create({
      data: {
        code: `p23-pulses-${runId}`,
        displayName: `Phase 23 Pulses ${runId}`,
        normalizedName: `phase23pulses${runId}`,
        active: true,
      },
    }),
  ]);
  assert.equal(english.active, true);
  assert.equal(tamil.active, true);
  assert.equal(inactiveLanguage.active, false);
  ids.crops.push(approvedCrop.id, disabledCrop.id, secondApprovedCrop.id);
  activeCrop = approvedCrop;
  inactiveCrop = disabledCrop;
  replacementCrop = secondApprovedCrop;
});

test('customer writes preserve legacy fields while resolving only approved active masters', async () => {
  const created = await customerService.createForSales({
    displayName: 'Phase 23 Customer',
    phone: `+9198${String(Date.now()).slice(-8)}`,
    preferredLanguage: 'en',
    state: 'Tamil Nadu',
    district: 'Synthetic District',
    mandal: 'Synthetic Mandal',
    village: 'Synthetic Village',
    kharifCrop: activeCrop.displayName,
    kharifAcres: 6.25,
    kharifTanks: 2.5,
    kharifSprayings: 3,
    subscriptionCardNumber: `P23-CARD-${runId}`,
    subscriptionYear: '2026-27',
  }, actor.id);
  customer = await prisma.customer.findUnique({ where: { id: created.customer.id } });
  ids.customers.push(customer.id);

  assert.equal(customer.kharifCrop, activeCrop.displayName);
  assert.equal(customer.rabiCrop, null);
  assert.equal(customer.summerCrop, null);
  assert.equal(customer.subscriptionYear, '2026-27');

  const [preferences, seasonalCrops, subscriptions, unknownCropCount] = await Promise.all([
    prisma.customerLanguagePreference.findMany({
      where: { customerId: customer.id },
      include: { language: true },
      orderBy: { rank: 'asc' },
    }),
    prisma.customerSeasonalCrop.findMany({ where: { customerId: customer.id } }),
    prisma.customerSubscription.findMany({ where: { customerId: customer.id } }),
    prisma.crop.count({ where: { normalizedName: `unknown runtime crop ${runId}` } }),
  ]);
  assert.deepEqual(preferences.map((preference) => [preference.language.code, preference.rank, preference.proficiency]), [
    ['en', 1, 'PRIMARY'],
  ]);
  assert.equal(seasonalCrops.length, 1);
  assert.equal(seasonalCrops[0].season, 'KHARIF');
  assert.equal(seasonalCrops[0].cropId, activeCrop.id);
  assert.equal(seasonalCrops[0].acreage.toString(), '6.25');
  assert.equal(seasonalCrops[0].tankQuantity.toString(), '2.5');
  assert.equal(seasonalCrops[0].expectedSprayings, 3);
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].cardNumber, `P23-CARD-${runId}`);
  assert.equal(subscriptions[0].status, 'UNKNOWN');
  assert.equal(unknownCropCount, 0, 'runtime writes must never invent a Crop master');

  const tamil = await prisma.language.findUnique({ where: { code: 'ta' } });
  await prisma.customerLanguagePreference.create({
    data: { customerId: customer.id, languageId: tamil.id, rank: 2, proficiency: 'BASIC' },
  });
  const updated = await customerService.updateForSales(customer.id, {
    preferredLanguage: 'ta',
    kharifCrop: activeCrop.displayName,
  }, actor.id);
  assert.equal(updated.preferredLanguage, 'ta');
  assert.equal(updated.kharifCrop, activeCrop.displayName);

  const reordered = await prisma.customerLanguagePreference.findMany({
    where: { customerId: customer.id },
    include: { language: true },
    orderBy: { rank: 'asc' },
  });
  assert.deepEqual(reordered.map((preference) => [preference.language.code, preference.rank, preference.proficiency]), [
    ['ta', 1, 'PRIMARY'],
    ['en', 2, 'STRONG'],
  ]);
  assert.equal(await prisma.customerSeasonalCrop.count({ where: { customerId: customer.id } }), 1);

  await assert.rejects(
    customerService.updateForSales(customer.id, { kharifCrop: `Still unknown ${runId}` }, actor.id),
    /active crop master/i,
  );
  const afterUnknownCrop = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(afterUnknownCrop.kharifCrop, activeCrop.displayName, 'legacy and normalized crop writes roll back together');
  assert.equal(await prisma.customerSeasonalCrop.count({ where: { customerId: customer.id, cropId: activeCrop.id } }), 1);

  await assert.rejects(customerService.createForSales({
    displayName: 'Phase 23 Inactive Language',
    phone: `+9197${String(Date.now() + 1).slice(-8)}`,
    preferredLanguage: 'ml',
  }, actor.id), /active language master/i);
  assert.equal(await prisma.customer.count({ where: { displayName: 'Phase 23 Inactive Language' } }), 0);

  await customerService.updateForSales(customer.id, { subscriptionCardNumber: '' }, actor.id);
  const cancelledSubscription = await prisma.customerSubscription.findUnique({
    where: { cardNumber: `P23-CARD-${runId}` },
  });
  assert.equal(cancelledSubscription.status, 'CANCELLED');
  assert.ok(cancelledSubscription.validUntil);
  const customerHistory = await prisma.customerHistory.findMany({
    where: { customerId: customer.id },
    orderBy: { version: 'asc' },
  });
  assert.ok(customerHistory.length >= 3);
  assert.equal(customerHistory.every((entry) => entry.actorUserId === actor.id), true);
  await prisma.language.update({ where: { code: 'ml' }, data: { active: true } });
});

test('runtime Location keys preserve fixed SQL slots and Unicode-normalized case', async () => {
  assert.equal(
    normalizedCompatibilityRepository.normalizedLocationKey({
      state: '  ＴＡＭＩＬ　ＮＡＤＵ  ',
      district: null,
      mandal: ' Synthetic\tMANDAL ',
      village: 'Cafe\u0301',
    }),
    'in|tamil nadu||synthetic mandal|café',
  );
  assert.equal(
    normalizedCompatibilityRepository.normalizedLocationKey({
      state: null,
      district: null,
      mandal: null,
      village: null,
    }),
    null,
  );
});

test('linked and staff Lead creation rejects unknown or inactive crop masters atomically', async () => {
  const before = {
    leads: await prisma.lead.count(),
    farmLocations: await prisma.farmLocation.count(),
    sprayPurposes: await prisma.leadSprayPurpose.count(),
  };
  const base = {
    customerId: customer.id,
    farmerName: customer.displayName,
    farmerPhone: customer.phone,
    acreage: 2,
    intakeChannel: 'MANUAL_SALES',
    latitude: center.latitude,
    longitude: center.longitude,
    matchedCenterId: center.id,
    status: 'PROCESSED',
  };

  await assert.rejects(
    leadRepository.create({ ...base, cropType: `Unknown linked crop ${runId}` }, {
      actorId: actor.id,
      sprayPurposes: ['Must roll back'],
    }),
    /active crop master/i,
  );
  await assert.rejects(
    leadRepository.create({ ...base, cropType: inactiveCrop.displayName }, { actorId: actor.id }),
    /active crop master/i,
  );
  assert.deepEqual({
    leads: await prisma.lead.count(),
    farmLocations: await prisma.farmLocation.count(),
    sprayPurposes: await prisma.leadSprayPurpose.count(),
  }, before);
});

test('linked validated leads atomically mirror acreage, crop, location, and safe spray purposes', async () => {
  const first = await intakeService.createIntake({
    customerId: customer.id,
    farmerName: customer.displayName,
    farmerPhone: customer.phone,
    acreage: 2.75,
    cropType: activeCrop.displayName,
    intakeChannel: 'MANUAL_SALES',
    latitude: center.latitude,
    longitude: center.longitude,
    farmerAddress: 'Synthetic Village, Synthetic District',
    preferredLanguage: 'ta',
    sprayPurpose: ['Pest control', ' Disease control ', 'Pest control'],
    actorId: actor.id,
  });
  assert.equal(first.outcome, 'ACCEPTED');
  ids.leads.push(first.lead.id);

  const stored = await prisma.lead.findUnique({
    where: { id: first.lead.id },
    include: { farmLocation: { include: { administrativeLocation: true } }, sprayPurposes: true },
  });
  assert.equal(stored.acreage, 2.75);
  assert.equal(stored.acreageDecimal.toString(), '2.75');
  assert.equal(stored.cropType, activeCrop.displayName);
  assert.equal(stored.cropId, activeCrop.id);
  assert.ok(stored.farmLocationId);
  assert.equal(stored.farmLocation.source, 'STAFF_CAPTURED');
  assert.equal(stored.farmLocation.verifiedByUserId, actor.id);
  assert.equal(stored.farmLocation.administrativeLocation.village, 'Synthetic Village');
  ids.locations.push(stored.farmLocation.administrativeLocation.id);
  const expectedLocationKey = normalizedCompatibilityRepository.normalizedLocationKey(customer);
  assert.equal(
    stored.farmLocation.administrativeLocation.normalizedKey,
    expectedLocationKey,
  );
  assert.equal(stored.farmLocation.administrativeLocation.normalizedKey.split('|').length, 5);
  assert.deepEqual(stored.sprayPurposes.map((purpose) => purpose.labelSnapshot).sort(), [
    'Disease control',
    'Pest control',
  ]);

  const repeated = await intakeService.createIntake({
    customerId: customer.id,
    farmerName: customer.displayName,
    farmerPhone: customer.phone,
    acreage: 1,
    cropType: activeCrop.displayName,
    intakeChannel: 'MANUAL_SALES',
    latitude: center.latitude,
    longitude: center.longitude,
    preferredLanguage: 'ta',
    sprayPurpose: 'Weed control; Weed control',
    actorId: actor.id,
  });
  ids.leads.push(repeated.lead.id);
  const repeatedStored = await prisma.lead.findUnique({
    where: { id: repeated.lead.id },
    include: { sprayPurposes: true },
  });
  assert.equal(repeatedStored.farmLocationId, stored.farmLocationId);
  assert.equal(repeatedStored.sprayPurposes.length, 1);
  assert.equal(await prisma.farmLocation.count({ where: { customerId: customer.id } }), 1);
  assert.equal(await prisma.location.count({ where: { normalizedKey: expectedLocationKey } }), 1);
  const attributedHistory = await prisma.leadHistory.findMany({
    where: { leadId: { in: [first.lead.id, repeated.lead.id] } },
  });
  assert.equal(attributedHistory.length, 2);
  assert.equal(attributedHistory.every((entry) => entry.actorUserId === actor.id), true);
});

test('Lead profile updates atomically replace normalized data while operational updates preserve it', async () => {
  const target = ids.leads[0];
  const before = await prisma.lead.findUnique({
    where: { id: target },
    include: { sprayPurposes: { orderBy: { purposeCode: 'asc' } } },
  });
  const farmLocationsBefore = await prisma.farmLocation.count();

  await leadRepository.updateProfile(target, {
    acreage: 4.5,
    cropType: replacementCrop.displayName,
    farmerAddress: 'Updated Synthetic Village',
    latitude: center.latitude + 0.001,
    longitude: center.longitude + 0.001,
    sprayPurpose: 'Coverage check; Weed control; Coverage check',
  }, { actorId: actor.id });

  const updated = await prisma.lead.findUnique({
    where: { id: target },
    include: { sprayPurposes: { orderBy: { labelSnapshot: 'asc' } } },
  });
  assert.equal(updated.acreage, 4.5);
  assert.equal(updated.acreageDecimal.toString(), '4.5');
  assert.equal(updated.cropType, replacementCrop.displayName);
  assert.equal(updated.cropId, replacementCrop.id);
  assert.notEqual(updated.farmLocationId, before.farmLocationId);
  assert.equal(await prisma.farmLocation.count(), farmLocationsBefore + 1);
  assert.deepEqual(updated.sprayPurposes.map((purpose) => purpose.labelSnapshot), [
    'Coverage check',
    'Weed control',
  ]);

  await leadRepository.updateProfile(target, {
    farmerAddress: 'Revised address at the same coordinates',
  }, { actorId: actor.id });
  const sameLocation = await prisma.lead.findUnique({
    where: { id: target },
    include: { farmLocation: true, sprayPurposes: { orderBy: { purposeCode: 'asc' } } },
  });
  assert.equal(sameLocation.farmLocationId, updated.farmLocationId);
  assert.equal(sameLocation.farmLocation.addressText, 'Revised address at the same coordinates');
  assert.equal(await prisma.farmLocation.count(), farmLocationsBefore + 1);

  await leadRepository.updateOperational(target, {
    status: updated.status,
    notes: 'Operational note only',
  }, { actorId: actor.id });
  const afterOperational = await prisma.lead.findUnique({
    where: { id: target },
    include: { sprayPurposes: { orderBy: { purposeCode: 'asc' } } },
  });
  assert.equal(afterOperational.acreageDecimal.toString(), updated.acreageDecimal.toString());
  assert.equal(afterOperational.cropId, updated.cropId);
  assert.equal(afterOperational.farmLocationId, updated.farmLocationId);
  assert.deepEqual(
    afterOperational.sprayPurposes.map((purpose) => purpose.purposeCode),
    updated.sprayPurposes.map((purpose) => purpose.purposeCode).sort(),
  );
  await assert.rejects(
    leadRepository.updateOperational(target, { acreage: 8 }, { actorId: actor.id }),
    /normalized profile update path/i,
  );

  await leadRepository.updateProfile(target, { sprayPurpose: '' }, { actorId: actor.id });
  const cleared = await prisma.lead.findUnique({
    where: { id: target },
    include: { sprayPurposes: true },
  });
  assert.equal(cleared.sprayPurpose, '');
  assert.equal(cleared.sprayPurposes.length, 0);
  assert.equal(cleared.acreageDecimal.toString(), updated.acreageDecimal.toString());
  assert.equal(cleared.cropId, updated.cropId);
  assert.equal(cleared.farmLocationId, updated.farmLocationId);

  const snapshot = {
    acreage: cleared.acreage,
    acreageDecimal: cleared.acreageDecimal.toString(),
    cropType: cleared.cropType,
    cropId: cleared.cropId,
    latitude: cleared.latitude,
    longitude: cleared.longitude,
    farmLocationId: cleared.farmLocationId,
    farmLocations: await prisma.farmLocation.count(),
    history: await prisma.leadHistory.count({ where: { leadId: target } }),
  };
  await assert.rejects(leadRepository.updateProfile(target, {
    acreage: 9,
    cropType: `Unknown update crop ${runId}`,
    latitude: center.latitude + 0.002,
    longitude: center.longitude + 0.002,
    sprayPurpose: 'Must not persist',
  }, { actorId: actor.id }), /active crop master/i);
  await assert.rejects(
    leadRepository.updateProfile(target, { cropType: inactiveCrop.displayName }, { actorId: actor.id }),
    /active crop master/i,
  );
  const afterRejected = await prisma.lead.findUnique({
    where: { id: target },
    include: { sprayPurposes: true },
  });
  assert.deepEqual({
    acreage: afterRejected.acreage,
    acreageDecimal: afterRejected.acreageDecimal.toString(),
    cropType: afterRejected.cropType,
    cropId: afterRejected.cropId,
    latitude: afterRejected.latitude,
    longitude: afterRejected.longitude,
    farmLocationId: afterRejected.farmLocationId,
    farmLocations: await prisma.farmLocation.count(),
    history: await prisma.leadHistory.count({ where: { leadId: target } }),
  }, snapshot);
  assert.equal(afterRejected.sprayPurposes.length, 0);
});

test('anonymous public leads retain legacy coordinates without creating customer farm locations', async () => {
  const beforeFarmLocations = await prisma.farmLocation.count();
  const result = await intakeService.createIntake({
    farmerName: 'Phase 23 Anonymous',
    farmerPhone: `+9196${String(Date.now() + 2).slice(-8)}`,
    acreage: 1.5,
    cropType: `Anonymous unknown crop ${runId}`,
    intakeChannel: 'WEBSITE',
    latitude: center.latitude,
    longitude: center.longitude,
    preferredLanguage: 'en',
    sprayPurpose: 'Nutrient application',
  });
  ids.leads.push(result.lead.id);
  const stored = await prisma.lead.findUnique({
    where: { id: result.lead.id },
    include: { sprayPurposes: true },
  });
  assert.equal(stored.customerId, null);
  assert.equal(stored.farmLocationId, null);
  assert.equal(stored.latitude, center.latitude);
  assert.equal(stored.longitude, center.longitude);
  assert.equal(stored.acreageDecimal.toString(), '1.5');
  assert.equal(stored.cropId, null);
  assert.equal(stored.cropType, `Anonymous unknown crop ${runId}`);
  assert.equal(stored.sprayPurposes.length, 1);
  assert.equal(await prisma.farmLocation.count(), beforeFarmLocations);
  assert.equal(await prisma.crop.count({ where: { normalizedName: `anonymous unknown crop ${runId}` } }), 0);
  const anonymousHistory = await prisma.leadHistory.findFirst({
    where: { leadId: result.lead.id, eventType: 'CREATED' },
  });
  assert.ok(anonymousHistory);
  assert.equal(anonymousHistory.actorUserId, null, 'public writes must not inherit a prior transaction actor');
});

test('a normalized relation failure rolls back the complete linked Lead write', async () => {
  const before = {
    leads: await prisma.lead.count(),
    farmLocations: await prisma.farmLocation.count(),
    locations: await prisma.location.count(),
  };
  await assert.rejects(leadRepository.create({
    customerId: customer.id,
    farmerName: customer.displayName,
    farmerPhone: customer.phone,
    acreage: 3,
    cropType: activeCrop.displayName,
    intakeChannel: 'MANUAL_SALES',
    latitude: center.latitude + 0.0001,
    longitude: center.longitude + 0.0001,
    matchedCenterId: center.id,
    status: 'PROCESSED',
  }, { actorId: crypto.randomUUID(), sprayPurposes: ['Rollback proof'] }));
  assert.equal(await prisma.lead.count(), before.leads);
  assert.equal(await prisma.farmLocation.count(), before.farmLocations);
  assert.equal(await prisma.location.count(), before.locations);
});

test.after(async () => {
  await prisma.leadSprayPurpose.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.leadHistory.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: 'Lead', entityId: { in: ids.leads } },
        { entityType: 'Customer', entityId: { in: ids.customers } },
      ],
    },
  });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.farmLocation.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customerSeasonalCrop.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customerSubscription.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customerLanguagePreference.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customerHistory.deleteMany({ where: { customerId: { in: ids.customers } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
  await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  await prisma.crop.deleteMany({ where: { id: { in: ids.crops } } });
  await prisma.language.updateMany({ where: { code: 'ml' }, data: { active: true } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.pricingConfig.deleteMany({ where: { id: { in: ids.pricing } } });
  await prisma.$disconnect();
});
