const crypto = require('crypto');
const customerRepository = require('../src/repositories/customerRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogService = require('./auditLogService');
const { hashPassword } = require('./passwordService');
const { normalizePhone } = require('./identityService');
const i18nService = require('./i18nService');

function safeCustomer(customer) {
  if (!customer) return null;
  return {
    id: customer.id,
    displayName: customer.displayName,
    phone: customer.phone,
    preferredLanguage: customer.preferredLanguage,
    ownership: customer.ownership,
    totalAcres: customer.totalAcres,
    village: customer.village,
    mandal: customer.mandal,
    district: customer.district,
    state: customer.state,
    kharifCrop: customer.kharifCrop,
    kharifOtherCrop: customer.kharifOtherCrop,
    kharifAcres: customer.kharifAcres,
    kharifTanks: customer.kharifTanks,
    kharifSprayings: customer.kharifSprayings,
    rabiCrop: customer.rabiCrop,
    rabiOtherCrop: customer.rabiOtherCrop,
    rabiAcres: customer.rabiAcres,
    rabiTanks: customer.rabiTanks,
    rabiSprayings: customer.rabiSprayings,
    summerCrop: customer.summerCrop,
    summerOtherCrop: customer.summerOtherCrop,
    summerAcres: customer.summerAcres,
    summerTanks: customer.summerTanks,
    summerSprayings: customer.summerSprayings,
    subscriptionCardNumber: customer.subscriptionCardNumber,
    subscriptionYear: customer.subscriptionYear,
    remarks: customer.remarks,
    hasFarmerPortalUser: Boolean(customer.farmerUserId),
    farmerPortalUserId: customer.farmerUserId || null,
    staffConfirmedAt: customer.staffConfirmedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    recentLeads: customer.leads || [],
  };
}

function validateName(value) {
  const name = String(value || '').trim();
  if (name.length < 2 || name.length > 120) throw new Error('Customer name must contain between 2 and 120 characters');
  return name;
}

function optionalText(value, field, maximum = 120) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maximum) throw new Error(`${field} must not exceed ${maximum} characters`);
  return text;
}

function optionalNonNegativeNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a non-negative number`);
  return number;
}

function optionalNonNegativeInteger(value, field) {
  const number = optionalNonNegativeNumber(value, field);
  if (number === null) return null;
  if (!Number.isInteger(number)) throw new Error(`${field} must be a whole number`);
  return number;
}

function optionalOwnership(value) {
  const ownership = optionalText(value, 'Ownership', 30);
  if (!ownership) return null;
  const normalized = ownership.toUpperCase();
  if (!['OWNER', 'TENANT'].includes(normalized)) throw new Error('Ownership must be OWNER or TENANT');
  return normalized;
}

function customerProfileInput(input, { partial = false } = {}) {
  const text = (key, label, maximum = 120) => (
    partial && input[key] === undefined ? undefined : optionalText(input[key], label, maximum)
  );
  const number = (key, label) => (
    partial && input[key] === undefined ? undefined : optionalNonNegativeNumber(input[key], label)
  );
  const integer = (key, label) => (
    partial && input[key] === undefined ? undefined : optionalNonNegativeInteger(input[key], label)
  );
  return {
    ownership: partial && input.ownership === undefined ? undefined : optionalOwnership(input.ownership),
    totalAcres: number('totalAcres', 'Total acres'),
    village: text('village', 'Village'),
    mandal: text('mandal', 'Mandal'),
    district: text('district', 'District'),
    state: text('state', 'State'),
    kharifCrop: text('kharifCrop', 'Kharif crop'),
    kharifOtherCrop: text('kharifOtherCrop', 'Other Kharif crop'),
    kharifAcres: number('kharifAcres', 'Kharif acres'),
    kharifTanks: number('kharifTanks', 'Kharif tanks'),
    kharifSprayings: integer('kharifSprayings', 'Kharif sprayings'),
    rabiCrop: text('rabiCrop', 'Rabi crop'),
    rabiOtherCrop: text('rabiOtherCrop', 'Other Rabi crop'),
    rabiAcres: number('rabiAcres', 'Rabi acres'),
    rabiTanks: number('rabiTanks', 'Rabi tanks'),
    rabiSprayings: integer('rabiSprayings', 'Rabi sprayings'),
    summerCrop: text('summerCrop', 'Summer crop'),
    summerOtherCrop: text('summerOtherCrop', 'Other Summer crop'),
    summerAcres: number('summerAcres', 'Summer acres'),
    summerTanks: number('summerTanks', 'Summer tanks'),
    summerSprayings: integer('summerSprayings', 'Summer sprayings'),
    subscriptionCardNumber: text('subscriptionCardNumber', 'Subscription card number', 80),
    subscriptionYear: text('subscriptionYear', 'Subscription year', 20),
    remarks: text('remarks', 'Remarks', 1000),
  };
}

async function findLinkedFarmer(phone) {
  return userRepository.findIdentityByPhone(phone, 'FARMER');
}

async function searchForSales({ query }) {
  const customers = await customerRepository.search({ query, take: 30 });
  return customers.map(safeCustomer);
}

async function createForSales(input, actorId) {
  const phone = normalizePhone(input.phone || input.farmerPhone);
  const existing = await customerRepository.findByPhone(phone);
  if (existing) return { customer: safeCustomer(existing), created: false };

  const linkedFarmer = await findLinkedFarmer(phone);
  const displayName = validateName(input.displayName || input.name || linkedFarmer?.name);
  const preferredLanguage = i18nService.normalizeLanguage(input.preferredLanguage || linkedFarmer?.preferredLanguage || 'ta');
  const customer = await customerRepository.create({
    displayName,
    phone,
    preferredLanguage,
    ...customerProfileInput(input),
    farmerUserId: linkedFarmer?.id || null,
    createdByUserId: actorId,
    staffConfirmedAt: new Date(),
  }, { actorId });
  await auditLogService.record({
    entityType: 'Customer',
    entityId: customer.id,
    action: 'SALES_CUSTOMER_CREATED',
    actorId,
    afterState: {
      status: 'STAFF_CONFIRMED',
      hasFarmerPortalUser: Boolean(customer.farmerUserId),
      preferredLanguage,
      phoneFingerprint: crypto.createHash('sha256').update(phone).digest('hex').slice(0, 12),
    },
  });
  return { customer: safeCustomer(customer), created: true };
}

async function updateForSales(customerId, input, actorId) {
  const existing = await customerRepository.findById(customerId);
  if (!existing) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
  const changes = customerProfileInput(input, { partial: true });
  if (input.displayName !== undefined) changes.displayName = validateName(input.displayName);
  if (input.preferredLanguage !== undefined) changes.preferredLanguage = i18nService.normalizeLanguage(input.preferredLanguage);
  const definedChanges = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
  if (!Object.keys(definedChanges).length) throw new Error('At least one customer field is required');
  const customer = await customerRepository.update(customerId, definedChanges, { actorId });
  await auditLogService.record({
    entityType: 'Customer',
    entityId: customer.id,
    action: 'SALES_CUSTOMER_PROFILE_UPDATED',
    actorId,
    afterState: {
      changedFields: Object.keys(definedChanges).sort(),
      profileStatus: 'STAFF_CONFIRMED',
    },
  });
  return safeCustomer(customer);
}

async function getServiceContext(customerId) {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
  return safeCustomer(customer);
}

async function ensureForFarmerUser(user) {
  const existingByUser = await customerRepository.findByFarmerUserId(user.id);
  if (existingByUser) return existingByUser;
  if (!user.phone) return null;
  const existingByPhone = await customerRepository.findByPhone(user.phone);
  if (existingByPhone) {
    if (existingByPhone.farmerUserId === user.id) return existingByPhone;
    if (!existingByPhone.farmerUserId) {
      return customerRepository.update(existingByPhone.id, { farmerUserId: user.id }, { actorId: user.id });
    }
    return null;
  }
  return customerRepository.create({
    displayName: validateName(user.name),
    phone: user.phone,
    preferredLanguage: i18nService.normalizeLanguage(user.preferredLanguage || 'ta'),
    village: optionalText(user.village, 'Village'),
    district: optionalText(user.district, 'District'),
    farmerUserId: user.id,
    staffConfirmedAt: user.phoneVerifiedAt || new Date(),
  }, { actorId: user.id });
}

async function openServiceContext(customerId, actorId) {
  const customer = await getServiceContext(customerId);
  await auditLogService.record({
    entityType: 'Customer',
    entityId: customer.id,
    action: 'SALES_SERVICE_VIEW_OPENED',
    actorId,
    afterState: {
      hasFarmerPortalUser: customer.hasFarmerPortalUser,
      recentLeadCount: customer.recentLeads.length,
    },
  });
  return customer;
}

function localFarmerEmail(customer) {
  return `farmer-${customer.id}@farmer.local`;
}

async function enableFarmerPortalAccess(customerId, actorId) {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
  const passwordHash = await hashPassword(crypto.randomBytes(48).toString('base64url'));
  const preferredLanguage = i18nService.normalizeLanguage(customer.preferredLanguage || 'ta');
  const result = await customerRepository.enableFarmerPortalAccess(customer.id, {
    name: customer.displayName,
    email: localFarmerEmail(customer),
    phone: customer.phone,
    passwordHash,
    role: 'FARMER',
    preferredLanguage,
    village: customer.village || null,
    district: customer.district || null,
    active: true,
  }, { actorId });
  if (!result) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
  await auditLogService.record({
    entityType: 'Customer',
    entityId: customer.id,
    action: result.createdUser ? 'FARMER_PORTAL_USER_CREATED' : 'FARMER_PORTAL_USER_LINKED',
    actorId,
    afterState: {
      status: 'PORTAL_ACCESS_ENABLED',
      farmerUserId: result.customer.farmerUserId,
      createdUser: result.createdUser,
      linkedExistingUser: result.linkedExistingUser,
      phoneFingerprint: crypto.createHash('sha256').update(customer.phone).digest('hex').slice(0, 12),
    },
  });
  return {
    customer: safeCustomer(result.customer),
    createdUser: result.createdUser,
    linkedExistingUser: result.linkedExistingUser,
  };
}

module.exports = {
  createForSales,
  enableFarmerPortalAccess,
  ensureForFarmerUser,
  getServiceContext,
  openServiceContext,
  searchForSales,
  safeCustomer,
  updateForSales,
};
