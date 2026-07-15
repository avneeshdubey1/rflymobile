const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let bhumeetToken = null;
let tokenExpiresAt = 0;

async function getBhumeetToken() {
    const token = process.env.BHUMEET_TOKEN;
    if (!token) {
        throw new Error("BHUMEET_TOKEN not found in .env");
    }
    return token;
}

/**
 * Periodically fetches flight data from Bhumeet API and stores it.
 * Interval controlled by BHUMEET_SYNC_INTERVAL_MS (default 5 min).
 */
function startBhumeetSyncJob() {
  const interval = parseInt(process.env.BHUMEET_SYNC_INTERVAL_MS || '300000', 10);
  console.log(`🚀 Starting Bhumeet sync job every ${interval / 1000}s`);

  // Immediate first run
  syncOnce();

  const timer = setInterval(syncOnce, interval);
  return timer;
}

async function syncOnce() {
  const baseUrl = process.env.BHUMEET_API_BASE;
  if (!baseUrl) {
    console.error('Bhumeet sync: BHUMEET_API_BASE not set');
    return;
  }
  const url = `${baseUrl}/flights`;
  try {
    const token = await getBhumeetToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      console.error('Bhumeet sync: HTTP error', response.status);
      return;
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) {
      console.warn('Bhumeet sync: unexpected payload format', payload);
      return;
    }
    for (const flight of payload) {
      const flightId = flight.id || flight.flightId;
      if (!flightId) continue;
      await prisma.bhumeetFlight.upsert({
        where: { flightId },
        update: { data: flight },
        create: { flightId, data: flight },
      });
    }
    console.log(`Bhumeet sync: fetched ${payload.length} flights`);
  } catch (err) {
    console.error('Bhumeet sync error:', err);
  }
}

module.exports = { startBhumeetSyncJob };
