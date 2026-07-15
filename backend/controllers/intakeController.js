const intakeService = require('../services/intakeService');
const leadRepository = require('../src/repositories/leadRepository');
const { parseCoordinates } = require('../services/locationParser');
const autoAssignmentService = require('../services/autoAssignmentService');
const logger = require('../services/loggerService');

function coordinatesFrom(body) {
  const direct = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  if (Number.isFinite(direct.latitude) && Number.isFinite(direct.longitude)) return direct;
  return parseCoordinates(body.mapsLink || body.village || '');
}

exports.website = async (req, res) => {
  try {
    const coordinates = coordinatesFrom(req.body);
    if (!coordinates) return res.status(400).json({ error: 'Please share a GPS location so we can confirm service availability.' });
    const result = await intakeService.createLead({
      farmerName: req.body.farmerName, farmerPhone: req.body.farmerPhone || req.body.phone,
      acreage: req.body.acreage ?? req.body.acres, cropType: req.body.cropType, farmerAddress: req.body.village,
      preferredLanguage: req.body.preferredLanguage || 'ta', intakeChannel: 'WEBSITE', ...coordinates,
    });
    logger.info('intake.website.created', { leadId: result.lead.id, intakeChannel: 'WEBSITE' });
    res.status(201).json({ success: true, lead: result.lead, inRange: Boolean(result.geofence.matchedCenter), appealOffer: result.appealOffer });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to submit service request' }); }
};

exports.googleForm = async (req, res) => {
  try {
    if (!req.body.formResponseId) return res.status(400).json({ error: 'formResponseId is required' });
    const existing = await leadRepository.findByFormResponseId(req.body.formResponseId);
    if (existing) return res.status(200).json({ success: true, duplicate: true, lead: existing });
    const coordinates = coordinatesFrom(req.body);
    if (!coordinates) return res.status(400).json({ error: 'A valid Google Maps pin is required' });
    const result = await intakeService.createLead({
      farmerName: req.body.farmerName, farmerPhone: req.body.farmerPhone, acreage: req.body.acreage,
      cropType: req.body.cropType, surveyorName: req.body.surveyorName, formResponseId: req.body.formResponseId,
      farmerAddress: req.body.mapsLink, intakeChannel: 'GOOGLE_FORM', ...coordinates,
    });
    res.status(201).json({ success: true, lead: result.lead });
  } catch (error) {
    if (error?.code === 'P2002' && req.body.formResponseId) {
      const existing = await leadRepository.findByFormResponseId(req.body.formResponseId);
      if (existing) return res.status(200).json({ success: true, duplicate: true, lead: existing });
    }
    return res.status(400).json({ error: error.message || 'Failed to ingest Google Form response' });
  }
};

exports.manual = async (req, res) => {
  try {
    const coordinates = coordinatesFrom(req.body);
    if (!coordinates) return res.status(400).json({ error: 'A valid farm location is required' });
    const result = await intakeService.createLead({
      farmerName: req.body.farmerName, farmerPhone: req.body.farmerPhone || req.body.phone,
      acreage: req.body.acreage ?? req.body.acres, cropType: req.body.cropType, farmerAddress: req.body.village,
      intakeChannel: 'MANUAL_SALES', ...coordinates,
    });
    const assignment = await autoAssignmentService.autoAssignProcessedLead(result.lead.id);
    res.status(201).json({ success: true, lead: result.lead, assignment });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to create manual lead' }); }
};
