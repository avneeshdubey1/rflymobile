const customerService = require('../services/customerService');
const intakeService = require('../services/intakeService');
const mobileOperationsRepository = require('../src/repositories/mobileOperationsRepository');

class OperationsMobileError extends Error {
  constructor(message, code = 'VALIDATION_FAILED', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function mobileError(res, req, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    error: {
      code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED'),
      message: status >= 500 ? 'Unable to complete the Operations request' : error.message,
      retryable: status >= 500,
      requestId: req.requestId,
    },
  });
}

function assertAllowedBody(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new OperationsMobileError('Request body must be an object');
  }
  const unexpected = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unexpected) throw new OperationsMobileError(`Unexpected field: ${unexpected}`);
}

function customerDto(customer) {
  return {
    id: customer.id,
    displayName: customer.displayName,
    phone: customer.phone,
    preferredLanguage: customer.preferredLanguage,
    ownership: customer.ownership,
    totalAcres: customer.totalAcres === null || customer.totalAcres === undefined
      ? null : String(customer.totalAcres),
    location: {
      village: customer.village,
      mandal: customer.mandal,
      district: customer.district,
      state: customer.state,
    },
    recentLeads: (customer.recentLeads || []).map((lead) => ({
      id: lead.id,
      status: lead.status,
      acreage: String(lead.acreage),
      crop: lead.cropType,
      createdAt: new Date(lead.createdAt).toISOString(),
    })),
  };
}

function leadDto(lead) {
  return {
    id: lead.id,
    status: lead.status,
    acreage: String(lead.acreage),
    crop: lead.cropType,
    operatingCenterId: lead.matchedCenterId,
    createdAt: new Date(lead.createdAt).toISOString(),
  };
}

async function searchCustomers(req, res) {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length > 120) throw new OperationsMobileError('Search query must not exceed 120 characters');
    const result = await customerService.searchForSales({
      query,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json({
      success: true,
      customers: result.customers.map(customerDto),
      pagination: result.pagination,
    });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function findCustomerByPhone(req, res) {
  try {
    const customer = await customerService.findByPhoneForSales(req.query.phone);
    if (!customer) throw new OperationsMobileError('Customer not found', 'RESOURCE_NOT_FOUND', 404);
    return res.json({ success: true, customer: customerDto(customer) });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function createCustomer(req, res) {
  try {
    assertAllowedBody(req.body, new Set([
      'displayName', 'phone', 'preferredLanguage', 'ownership', 'totalAcres',
      'village', 'mandal', 'district', 'state',
    ]));
    const result = await customerService.createForSales(req.body, req.auth.userId);
    return res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      customer: customerDto(result.customer),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      error.status = 409;
      error.code = 'CUSTOMER_PHONE_CONFLICT';
      error.message = 'That customer phone is already registered';
    }
    return mobileError(res, req, error);
  }
}

async function createLead(req, res) {
  try {
    assertAllowedBody(req.body, new Set([
      'acreage', 'latitude', 'longitude', 'farmerAddress', 'cropType', 'notes',
      'soilType', 'cropAgeWeeks', 'chemicalBrand', 'sprayPurpose', 'hasChemical',
      'chemicalProofUrl', 'expectedDate', 'expectedTime', 'waterBodyNearby', 'terrainType',
    ]));
    const customer = await customerService.getServiceContext(req.params.customerId);
    const result = await intakeService.createIntake({
      ...req.body,
      farmerName: customer.displayName,
      farmerPhone: customer.phone,
      farmerAddress: req.body.farmerAddress || [customer.village, customer.district].filter(Boolean).join(', '),
      preferredLanguage: customer.preferredLanguage,
      customerId: customer.id,
      intakeChannel: 'MANUAL_SALES',
      actorId: req.auth.userId,
    });
    if (result.outcome === 'DECLINED') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'OUTSIDE_SERVICE_AREA',
          message: 'Service is unavailable at this location',
          retryable: false,
          requestId: req.requestId,
        },
      });
    }
    const assignment = await intakeService.triggerAutoAssignment(result.lead.id, req.auth.userId);
    return res.status(201).json({
      success: true,
      outcome: 'ACCEPTED',
      lead: leadDto(result.lead),
      assignmentOutcome: assignment?.outcome || null,
    });
  } catch (error) {
    if (error.status === 404) error.code = 'RESOURCE_NOT_FOUND';
    return mobileError(res, req, error);
  }
}

function assertScheduleQuery(query) {
  if (Object.keys(query).some((field) => !['from', 'to'].includes(field))) {
    throw new OperationsMobileError('Schedule query is invalid');
  }
}

async function fleetSchedule(req, res) {
  try {
    assertScheduleQuery(req.query);
    return res.json({ success: true, ...(await mobileOperationsRepository.listSchedule(req.query)) });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function fleetExceptions(req, res) {
  try {
    assertScheduleQuery(req.query);
    return res.json({ success: true, ...(await mobileOperationsRepository.listExceptions(req.query)) });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

module.exports = { createCustomer, createLead, findCustomerByPhone, fleetExceptions, fleetSchedule, searchCustomers };
