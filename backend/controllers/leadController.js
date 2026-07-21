const leadRepository = require('../src/repositories/leadRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const autoAssignmentService = require('../services/autoAssignmentService');
const whatsappService = require('../services/whatsappService');
const geofenceService = require('../services/geofenceService');

const intakeChannels = new Set(['WEBSITE', 'GOOGLE_FORM', 'MANUAL_SALES']);

exports.createLead = async (req, res) => {
  try {
    const { 
      farmerName, farmerPhone, phone, acreage, acres, 
      intakeChannel = 'WEBSITE', 
      soilType, cropAgeWeeks, chemicalBrand, sprayPurpose, 
      hasChemical, chemicalProofUrl, expectedDate, expectedTime, 
      waterBodyNearby, terrainType, 
      ...optional 
    } = req.body;

    if (!farmerName || !(acreage ?? acres)) return res.status(400).json({ error: 'farmerName and acreage are required' });
    if (!intakeChannels.has(intakeChannel)) return res.status(400).json({ error: 'Invalid intakeChannel' });

    let calculatedStatus = 'NEW';
    let addedNotes = [];

    if (waterBodyNearby === true) {
      calculatedStatus = 'FLAGGED';
      addedNotes.push('REQUIRES BUFFER ZONE REVIEW');
    }

    if (terrainType === 'Mountainous') {
      calculatedStatus = 'FLAGGED';
      addedNotes.push('HIGH TERRAIN RISK');
    }

    if (hasChemical === false) {
      addedNotes.push(`COMPANY PROCUREMENT NEEDED: ${chemicalBrand || 'Unknown brand'}`);
    } else if (hasChemical === true && !chemicalProofUrl) {
      calculatedStatus = 'MANUAL_CALL_REQUIRED';
    }

    if (expectedDate) {
      const sprayDate = new Date(expectedDate);
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      if (sprayDate > maxDate) {
         return res.status(400).json({ error: 'Expected date cannot be more than 3 months in advance' });
      }
    }

    // Try parsing mapsLink or latitude/longitude for geofencing
    let lat = null, lng = null;
    let matchedCenterId = null, distanceFromCenterKm = null;
    
    if (latitude !== undefined && longitude !== undefined) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
    } else if (optional.mapsLink && optional.mapsLink.includes(',')) {
      const parts = optional.mapsLink.split(',');
      if (parts.length === 2) {
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      const geofence = await geofenceService.evaluate(lat, lng);
      if (geofence.matchedCenter) {
        matchedCenterId = geofence.matchedCenter.id;
        distanceFromCenterKm = geofence.distanceKm;
      } else {
        calculatedStatus = 'OUT_OF_RANGE';
        addedNotes.push(`Geofence failed. Distance from nearest center: ${geofence.distanceKm ? geofence.distanceKm.toFixed(2) : 'N/A'}km`);
      }
    }

    if (calculatedStatus === 'NEW' && matchedCenterId) {
      calculatedStatus = 'PROCESSED';
    }

    const newNotes = [optional.notes, ...addedNotes].filter(Boolean).join('\n');

    const lead = await leadRepository.create({ 
      farmerName, 
      farmerPhone: farmerPhone || phone || '', 
      acreage: Number(acreage ?? acres), 
      intakeChannel, 
      soilType,
      cropAgeWeeks: cropAgeWeeks ? Number(cropAgeWeeks) : null,
      chemicalBrand,
      sprayPurpose,
      hasChemical: hasChemical !== false,
      chemicalProofUrl,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      expectedTime,
      waterBodyNearby: Boolean(waterBodyNearby),
      terrainType,
      latitude: lat,
      longitude: lng,
      matchedCenterId,
      distanceFromCenterKm,
      status: calculatedStatus,
      notes: newNotes,
      ...optional 
    });

    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'CREATED', afterState: lead });
    
    let assignment = null;
    if (calculatedStatus === 'PROCESSED') {
      try {
        await whatsappService.sendForStatus(lead, 'PROCESSED');
        assignment = await autoAssignmentService.autoAssignProcessedLead(lead.id);
      } catch (err) {
        console.error("Auto assignment failed:", err);
      }
    }

    res.status(201).json({ success: true, lead, assignment });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Failed to create lead' }); 
  }
};

exports.getAllLeads = async (_req, res) => {
  try { res.json({ success: true, leads: await leadRepository.findAll() }); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch leads' }); }
};

exports.getPendingLeads = async (_req, res) => {
  try {
    const leads = await leadRepository.findAll({ status: { in: ['NEW', 'OUT_OF_RANGE', 'APPEAL_PENDING', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING'] } });
    res.json({ success: true, leads });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch leads' }); }
};

// Phase 1 preserves the legacy endpoint without beginning Phase 2's intake/geofence flow.
exports.processLead = async (req, res) => {
  try {
    const before = await leadRepository.findById(req.body.id);
    if (!before) return res.status(404).json({ error: 'Lead not found' });
    if (before.status !== 'NEW') return res.status(409).json({ error: 'Only NEW leads can be processed by Sales' });
    const detailFields = [
      ['Mandal', req.body.mandal],
      ['District', req.body.district],
      ['Soil type', req.body.soilType],
      ['Crop age', req.body.cropAge],
      ['Product', req.body.pesticideBrand],
      ['Expected spraying', req.body.expectedSpraying],
    ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}: ${String(value).trim().slice(0, 160)}`);
    const lead = await leadRepository.update(before.id, {
      status: 'PROCESSED',
      processedAt: new Date(),
      notes: detailFields.length ? detailFields.join('\n') : before.notes,
    });
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: before, afterState: lead });
    await whatsappService.sendForStatus(lead, 'PROCESSED');
    const assignment = await autoAssignmentService.autoAssignProcessedLead(lead.id);
    res.json({ success: true, lead, assignment });
  } catch (error) { res.status(500).json({ error: error.message || 'Failed to process lead' }); }
};
