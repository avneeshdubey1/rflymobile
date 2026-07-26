const intakeService = require('../services/intakeService');
const whatsappService = require('../services/whatsappService');
const { parseCoordinates } = require('../services/locationParser');
const logger = require('../services/loggerService');

function coordinatesFrom(body) {
  const coordinate = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const direct = { latitude: coordinate(body.latitude), longitude: coordinate(body.longitude) };
  if (direct.latitude !== null && direct.longitude !== null) return direct;
  return parseCoordinates(body.mapsLink || '');
}

function addressFrom(body) {
  const pieces = [body.village, body.district]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
  return pieces.join(', ');
}

function sprayPurposeFrom(value) {
  if (!Array.isArray(value)) return value;
  if (value.some((item) => typeof item !== 'string')) return value;
  return value.map((item) => item.trim()).filter(Boolean).join(', ');
}

function allowedFields(body, { farmerName, farmerPhone, intakeChannel, actorId, preferredLanguage } = {}) {
  return {
    farmerName,
    farmerPhone,
    acreage: body.acreage ?? body.acres,
    intakeChannel,
    farmerAddress: addressFrom(body),
    cropType: body.cropType,
    notes: body.notes,
    preferredLanguage,
    soilType: body.soilType,
    cropAgeWeeks: body.cropAgeWeeks,
    chemicalBrand: body.chemicalBrand,
    sprayPurpose: sprayPurposeFrom(body.sprayPurpose),
    hasChemical: body.hasChemical,
    chemicalProofUrl: body.chemicalProofUrl,
    expectedDate: body.expectedDate,
    expectedTime: body.expectedTime,
    waterBodyNearby: body.waterBodyNearby,
    terrainType: body.terrainType,
    actorId,
  };
}

function presentLead(lead) {
  return {
    id: lead.id,
    acreage: lead.acreage,
    cropType: lead.cropType,
    farmerAddress: lead.farmerAddress,
    status: lead.status,
    createdAt: lead.createdAt,
  };
}

function decline(res) {
  return res.status(422).json({
    success: false,
    outcome: 'DECLINED',
    code: 'OUTSIDE_SERVICE_AREA',
    messageKey: 'service_area_unavailable',
  });
}

async function submit(req, res, { intakeChannel, actorId = null, farmerName, farmerPhone, preferredLanguage, autoAssign = false }) {
  const coordinates = coordinatesFrom(req.body);
  if (!coordinates) {
    return res.status(400).json({ code: 'LOCATION_REQUIRED', messageKey: 'service_location_required' });
  }
  const result = await intakeService.createIntake({
    ...allowedFields(req.body, { farmerName, farmerPhone, intakeChannel, actorId, preferredLanguage }),
    ...coordinates,
  });
  if (result.outcome === 'DECLINED') return decline(res);

  let assignment = null;
  if (autoAssign && result.lead.status === 'PROCESSED') {
    await whatsappService.sendForStatus(result.lead, 'PROCESSED');
    assignment = await intakeService.triggerAutoAssignment(result.lead.id);
  }
  logger.info('intake.accepted', { leadId: result.lead.id, intakeChannel, status: result.lead.status });
  return res.status(201).json({
    success: true,
    outcome: 'ACCEPTED',
    lead: presentLead(result.lead),
    assignmentOutcome: assignment?.outcome || null,
  });
}

exports.website = async (req, res) => {
  try {
    return await submit(req, res, {
      intakeChannel: 'WEBSITE',
      farmerName: req.body.farmerName,
      farmerPhone: req.body.farmerPhone ?? req.body.phone,
      preferredLanguage: req.body.preferredLanguage || 'ta',
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to submit service request' });
  }
};

exports.manual = async (req, res) => {
  try {
    return await submit(req, res, {
      intakeChannel: 'MANUAL_SALES',
      actorId: req.auth.userId,
      farmerName: req.body.farmerName,
      farmerPhone: req.body.farmerPhone ?? req.body.phone,
      preferredLanguage: req.body.preferredLanguage || 'ta',
      autoAssign: true,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create manual lead' });
  }
};

exports.farmer = async (req, res) => {
  try {
    if (!req.authUser.phone) return res.status(409).json({ code: 'FARMER_PHONE_UNAVAILABLE' });
    return await submit(req, res, {
      intakeChannel: 'WEBSITE',
      actorId: req.auth.userId,
      farmerName: req.authUser.name,
      farmerPhone: req.authUser.phone,
      preferredLanguage: req.authUser.preferredLanguage || 'ta',
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to submit service request' });
  }
};
