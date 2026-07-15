const fetch = require('node-fetch');
const { createLead } = require('../services/intakeService');
const { autoAssignProcessedLead } = require('../services/autoAssignmentService');
const { extractCoordinatesFromLink } = require('../services/locationParser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Pulls leads from the Google Apps Script JSON endpoint and creates Lead entries.
 * This job runs on an interval defined by process.env.GOOGLE_FORM_SYNC_INTERVAL_MS.
 */
function startGoogleFormSyncJob() {
  const interval = parseInt(process.env.GOOGLE_FORM_SYNC_INTERVAL_MS || '300000', 10);
  console.log(`🚀 Starting Google Form sync job every ${interval / 1000}s`);

  // Immediate first run
  syncOnce();

  const timer = setInterval(syncOnce, interval);
  return timer;
}

async function syncOnce() {
  try {
    let response;
    for (let i = 0; i < 3; i++) {
      try {
        response = await fetch(process.env.GOOGLE_FORM_SCRIPT_URL);
        if (response.ok) break;
      } catch (err) {
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!response.ok) {
      console.error('Google Form sync: HTTP error', response.status);
      return;
    }
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.data)) {
      console.warn('Google Form sync: unexpected payload', payload);
      return;
    }
    for (const row of payload.data) {
      const formResponseId = `${row.Timestamp}-${row['Farmer Mobile Number  ']}`;
      // Check for duplicate
      const exists = await prisma.lead.findUnique({ where: { formResponseId } });
      if (exists) continue;

      // Extract coordinates from Google Maps link if present
      let latitude, longitude;
      const mapsLink = row['Field Location (Google Maps Link)  '];
      const coords = await extractCoordinatesFromLink(mapsLink);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
      
      // Fallback to Srivilliputur location if coordinates are missing/unparseable
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        latitude = 9.54752;
        longitude = 77.538;
      }

      const leadData = {
        farmerName: row['Farmer Name '].trim(),
        farmerPhone: String(row['Farmer Mobile Number  ']).trim(),
        latitude,
        longitude,
        acreage: parseFloat(row['Total Acres']),
        cropType: row['Crop name']?.trim(),
        notes: row['Purpose of Spraying']?.trim(),
        preferredLanguage: 'en', // default, could be derived later
        intakeChannel: 'GOOGLE_FORM',
        formResponseId,
        surveyorName: row['Surveyor Name']?.trim(),
        createdAt: new Date(row.Timestamp),
      };
      const { lead } = await createLead(leadData);
      console.log(`Google Form sync: imported lead ${leadData.farmerName}`);
      if (lead.status === 'PROCESSED') {
        await autoAssignProcessedLead(lead.id);
        console.log(`Google Form sync: auto-assigned lead ${lead.id}`);
      }
    }
  } catch (err) {
    console.error('Google Form sync error:', err);
  }
}

module.exports = { startGoogleFormSyncJob };
