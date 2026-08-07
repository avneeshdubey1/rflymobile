const crypto = require('crypto');

const SEASONS = [
  {
    season: 'KHARIF',
    cropField: 'kharifCrop',
    otherCropField: 'kharifOtherCrop',
    acreageField: 'kharifAcres',
    tankField: 'kharifTanks',
    sprayingsField: 'kharifSprayings',
  },
  {
    season: 'RABI',
    cropField: 'rabiCrop',
    otherCropField: 'rabiOtherCrop',
    acreageField: 'rabiAcres',
    tankField: 'rabiTanks',
    sprayingsField: 'rabiSprayings',
  },
  {
    season: 'SUMMER',
    cropField: 'summerCrop',
    otherCropField: 'summerOtherCrop',
    acreageField: 'summerAcres',
    tankField: 'summerTanks',
    sprayingsField: 'summerSprayings',
  },
];

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function lookupText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();
  return normalized || null;
}

function cropLookupValues(value) {
  const normalized = lookupText(value);
  if (!normalized) return [];
  const code = normalized
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, '');
  return [...new Set([normalized, code, compact].filter(Boolean))];
}

function decimalValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : null;
}

function compatibilityError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  return error;
}

async function findActiveLanguage(transaction, code) {
  const normalized = lookupText(code);
  if (!normalized) return null;
  return transaction.language.findFirst({
    where: { active: true, code: { equals: normalized, mode: 'insensitive' } },
  });
}

async function findActiveCrop(transaction, value) {
  const lookups = cropLookupValues(value);
  if (!lookups.length) return null;
  return transaction.crop.findFirst({
    where: {
      active: true,
      OR: [
        ...lookups.map((lookup) => ({ code: { equals: lookup, mode: 'insensitive' } })),
        { displayName: { equals: cleanText(value), mode: 'insensitive' } },
        ...lookups.map((lookup) => ({ normalizedName: { equals: lookup, mode: 'insensitive' } })),
      ],
    },
  });
}

async function syncPrimaryLanguage(transaction, customer) {
  const language = await findActiveLanguage(transaction, customer.preferredLanguage);
  if (!language) {
    throw compatibilityError(
      'ACTIVE_LANGUAGE_MASTER_REQUIRED',
      'The selected language is not available in the active language master',
    );
  }

  const existing = await transaction.customerLanguagePreference.findMany({
    where: { customerId: customer.id },
    orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
  });
  if (
    existing[0]?.languageId === language.id
    && existing[0]?.rank === 1
    && existing[0]?.proficiency === 'PRIMARY'
  ) return;

  const reordered = [
    { languageId: language.id, proficiency: 'PRIMARY' },
    ...existing
      .filter((preference) => preference.languageId !== language.id)
      .map((preference) => ({
        languageId: preference.languageId,
        proficiency: preference.proficiency === 'PRIMARY' ? 'STRONG' : preference.proficiency,
      })),
  ].slice(0, 10);

  await transaction.customerLanguagePreference.deleteMany({ where: { customerId: customer.id } });
  if (reordered.length) {
    await transaction.customerLanguagePreference.createMany({
      data: reordered.map((preference, index) => ({
        customerId: customer.id,
        languageId: preference.languageId,
        rank: index + 1,
        proficiency: preference.proficiency,
      })),
    });
  }
}

function preferredSeasonCrop(customer, season) {
  const primary = cleanText(customer[season.cropField]);
  const other = cleanText(customer[season.otherCropField]);
  if (!primary) return other;
  if (/^other(?:\s+crop)?$/i.test(primary)) return other;
  return primary;
}

async function syncSeasonalCrops(transaction, customer) {
  for (const season of SEASONS) {
    const legacyCropName = preferredSeasonCrop(customer, season);
    const rawPrimary = cleanText(customer[season.cropField]);
    const rawOther = cleanText(customer[season.otherCropField]);
    const currentWhere = { customerId: customer.id, season: season.season, seasonYear: null };
    if (!legacyCropName) {
      if (rawPrimary && /^other(?:\s+crop)?$/i.test(rawPrimary) && !rawOther) {
        throw compatibilityError(
          'OTHER_CROP_NAME_REQUIRED',
          `${season.season} other crop name is required`,
        );
      }
      await transaction.customerSeasonalCrop.deleteMany({ where: currentWhere });
      continue;
    }
    const crop = await findActiveCrop(transaction, legacyCropName);
    if (!crop) {
      throw compatibilityError(
        'ACTIVE_CROP_MASTER_REQUIRED',
        `${season.season} crop is not available in the active crop master`,
      );
    }

    const values = {
      cropId: crop.id,
      acreage: decimalValue(customer[season.acreageField]),
      tankQuantity: decimalValue(customer[season.tankField]),
      expectedSprayings: customer[season.sprayingsField] ?? null,
    };
    const existing = await transaction.customerSeasonalCrop.findFirst({
      where: currentWhere,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing) {
      await transaction.customerSeasonalCrop.update({ where: { id: existing.id }, data: values });
    } else {
      await transaction.customerSeasonalCrop.create({
        data: { customerId: customer.id, season: season.season, seasonYear: null, ...values },
      });
    }
  }
}

async function syncSubscription(transaction, customer) {
  const cardNumber = cleanText(customer.subscriptionCardNumber);
  const current = await transaction.customerSubscription.findMany({
    where: { customerId: customer.id, status: { in: ['ACTIVE', 'UNKNOWN'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!cardNumber) {
    if (current.length) {
      await transaction.customerSubscription.updateMany({
        where: { id: { in: current.map((item) => item.id) } },
        data: { status: 'CANCELLED', validUntil: new Date() },
      });
    }
    return;
  }

  const cardOwner = await transaction.customerSubscription.findUnique({ where: { cardNumber } });
  if (cardOwner && cardOwner.customerId !== customer.id) {
    throw compatibilityError(
      'SUBSCRIPTION_CARD_ALREADY_ASSIGNED',
      'The subscription card is already assigned to another customer',
    );
  }

  const existing = cardOwner || current.find((item) => item.cardNumber === cardNumber);
  const replacedIds = current
    .filter((item) => item.id !== existing?.id)
    .map((item) => item.id);
  if (replacedIds.length) {
    await transaction.customerSubscription.updateMany({
      where: { id: { in: replacedIds } },
      data: { status: 'CANCELLED', validUntil: new Date() },
    });
  }
  if (existing) {
    await transaction.customerSubscription.update({
      where: { id: existing.id },
      data: {
        cardNumber,
        status: existing.status === 'CANCELLED' || existing.status === 'EXPIRED' ? 'UNKNOWN' : existing.status,
        validFrom: existing.validFrom || new Date(),
        validUntil: null,
      },
    });
  } else {
    await transaction.customerSubscription.create({
      data: { customerId: customer.id, cardNumber, status: 'UNKNOWN', validFrom: new Date() },
    });
  }
}

async function syncCustomer(transaction, customer) {
  await syncPrimaryLanguage(transaction, customer);
  await syncSeasonalCrops(transaction, customer);
  await syncSubscription(transaction, customer);
}

function normalizedLocationKey(customer) {
  const parts = [customer.state, customer.district, customer.mandal, customer.village]
    .map(lookupText);
  if (parts.every((part) => !part)) return null;
  // Keep all four administrative slots, including empty ones. This matches the
  // canonical IN|state|district|mandal|village key used by migration/import
  // reconciliation and prevents differently incomplete addresses from
  // collapsing into the same variable-width key.
  return ['in', ...parts.map((part) => part || '')].join('|');
}

async function resolveAdministrativeLocation(transaction, customer) {
  const normalizedKey = normalizedLocationKey(customer);
  if (!normalizedKey) return null;
  return transaction.location.upsert({
    where: { normalizedKey },
    update: {},
    create: {
      countryCode: 'IN',
      state: cleanText(customer.state),
      district: cleanText(customer.district),
      mandal: cleanText(customer.mandal),
      village: cleanText(customer.village),
      normalizedKey,
    },
  });
}

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
}

async function resolveFarmLocationForLead(transaction, leadData, { actorId = null } = {}) {
  if (!leadData.customerId || !leadData.matchedCenterId) return null;
  const latitude = Number(leadData.latitude);
  const longitude = Number(leadData.longitude);
  if (!validCoordinates(latitude, longitude)) return null;

  const customer = await transaction.customer.findUnique({ where: { id: leadData.customerId } });
  if (!customer) return null;
  const coordinatePair = { latitude: latitude.toFixed(7), longitude: longitude.toFixed(7) };
  const administrativeLocation = await resolveAdministrativeLocation(transaction, customer);
  const sharedValues = {
    administrativeLocationId: administrativeLocation?.id || null,
    label: cleanText(customer.village) || 'Service location',
    addressText: cleanText(leadData.farmerAddress)
      || [customer.village, customer.mandal, customer.district, customer.state].map(cleanText).filter(Boolean).join(', ')
      || null,
    source: leadData.intakeChannel === 'MANUAL_SALES' ? 'STAFF_CAPTURED' : 'PUBLIC_WEBSITE',
    verifiedAt: new Date(),
    ...(actorId ? { verifiedByUserId: actorId } : {}),
  };
  const existing = await transaction.farmLocation.findFirst({
    where: { customerId: customer.id, active: true, ...coordinatePair },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return transaction.farmLocation.update({ where: { id: existing.id }, data: sharedValues });
  }

  return transaction.farmLocation.create({
    data: {
      customerId: customer.id,
      ...sharedValues,
      ...coordinatePair,
      verifiedByUserId: actorId || null,
    },
  });
}

function structuredSprayPurposes(value) {
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  if (values.some((item) => typeof item !== 'string')) return [];
  const labels = values
    .flatMap((item) => item.split(/[,;]/))
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 20);
  const unique = new Map();
  for (const label of labels) {
    const comparisonKey = lookupText(label);
    if (!comparisonKey || unique.has(comparisonKey)) continue;
    const digest = crypto.createHash('sha256').update(comparisonKey).digest('hex').slice(0, 12);
    const slug = comparisonKey
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    unique.set(comparisonKey, {
      purposeCode: `${slug || 'purpose'}-${digest}`.slice(0, 80),
      labelSnapshot: label.length <= 160 ? label : null,
    });
  }
  return [...unique.values()];
}

function requiresControlledCrop(leadData) {
  return Boolean(leadData.customerId) || leadData.intakeChannel === 'MANUAL_SALES';
}

async function resolveLeadCrop(transaction, leadData) {
  const rawCrop = cleanText(leadData.cropType);
  if (!rawCrop) return null;
  const crop = await findActiveCrop(transaction, rawCrop);
  if (!crop && requiresControlledCrop(leadData)) {
    throw compatibilityError(
      'ACTIVE_CROP_MASTER_REQUIRED',
      'The crop is not available in the active crop master',
    );
  }
  return crop;
}

function leadAcreageDecimal(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw compatibilityError('VALID_LEAD_ACREAGE_REQUIRED', 'Lead acreage must be a positive number');
  }
  return String(parsed);
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field);
}

async function prepareLead(transaction, leadData, options = {}) {
  const crop = await resolveLeadCrop(transaction, leadData);
  const farmLocation = await resolveFarmLocationForLead(transaction, leadData, options);
  return {
    data: {
      ...leadData,
      acreageDecimal: leadAcreageDecimal(leadData.acreage),
      cropId: crop?.id || null,
      farmLocationId: farmLocation?.id || null,
    },
    replaceSprayPurposes: true,
    sprayPurposes: structuredSprayPurposes(options.sprayPurposes ?? leadData.sprayPurpose),
  };
}

async function prepareLeadProfileUpdate(transaction, currentLead, patch, options = {}) {
  const merged = { ...currentLead, ...patch };
  const crop = await resolveLeadCrop(transaction, merged);
  const locationFields = ['customerId', 'matchedCenterId', 'latitude', 'longitude', 'farmerAddress'];
  const locationChanged = locationFields.some((field) => hasOwn(patch, field));
  const farmLocation = locationChanged
    ? await resolveFarmLocationForLead(transaction, merged, options)
    : null;
  const replaceSprayPurposes = hasOwn(options, 'sprayPurposes') || hasOwn(patch, 'sprayPurpose');
  const sprayPurposeInput = hasOwn(options, 'sprayPurposes')
    ? options.sprayPurposes
    : patch.sprayPurpose;

  return {
    data: {
      ...patch,
      acreageDecimal: leadAcreageDecimal(merged.acreage),
      cropId: crop?.id || null,
      farmLocationId: locationChanged ? farmLocation?.id || null : currentLead.farmLocationId,
    },
    replaceSprayPurposes,
    sprayPurposes: replaceSprayPurposes ? structuredSprayPurposes(sprayPurposeInput) : [],
  };
}

/*
 * Keep normalized Lead profile writes separate from operational transitions.
 * Callers updating status/timestamps must not call this preparation path,
 * because an incomplete transition payload cannot be allowed to clear profile
 * relations.
 */
async function prepareLeadProfile(transaction, currentLead, patch, options = {}) {
  return prepareLeadProfileUpdate(transaction, currentLead, patch, options);
}

module.exports = {
  prepareLead,
  prepareLeadProfile,
  normalizedLocationKey,
  syncCustomer,
};
