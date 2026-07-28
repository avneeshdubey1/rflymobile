const crypto = require('crypto');
const customerRepository = require('../src/repositories/customerRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogService = require('./auditLogService');
const { normalizePhone } = require('./identityService');
const i18nService = require('./i18nService');

function safeCustomer(customer) {
  if (!customer) return null;
  return {
    id: customer.id,
    displayName: customer.displayName,
    phone: customer.phone,
    preferredLanguage: customer.preferredLanguage,
    village: customer.village,
    district: customer.district,
    hasFarmerPortalUser: Boolean(customer.farmerUserId),
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
    village: optionalText(input.village, 'Village'),
    district: optionalText(input.district, 'District'),
    farmerUserId: linkedFarmer?.id || null,
    createdByUserId: actorId,
    staffConfirmedAt: new Date(),
  });
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
      return customerRepository.update(existingByPhone.id, { farmerUserId: user.id });
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
  });
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

module.exports = {
  createForSales,
  ensureForFarmerUser,
  getServiceContext,
  openServiceContext,
  searchForSales,
  safeCustomer,
};
