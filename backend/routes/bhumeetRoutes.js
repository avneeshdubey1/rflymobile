const express = require('express');
const router = express.Router();
const prisma = require('../src/lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/logs', authenticate, authorize('ADMIN', 'FLEET_MANAGER'), async (req, res) => {
  try {
    const rawFlights = await prisma.bhumeetFlight.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 100, // Limit to 100 for display
    });
    // The data is stored in the `data` JSON column, so we flatten it for the frontend
    const flights = rawFlights.map(f => ({
      id: f.id,
      remoteFlightId: f.flightId,
      fetchedAt: f.fetchedAt,
      ...(typeof f.data === 'object' && f.data ? f.data : {})
    }));
    res.json({ success: true, flights });
  } catch (error) {
    console.error('Failed to fetch bhumeet logs:', error);
    res.status(500).json({ error: 'Failed to fetch bhumeet logs' });
  }
});

// Mock Dashboard Endpoints
router.get('/overview', authenticate, (req, res) => {
    res.json({
        success: true,
        data: {
            totalDrones: 5,
            totalPilots: 4,
            activeMissions: 2,
            pendingMaintenance: 1,
            revenueThisMonth: "₹1,45,000"
        }
    });
});

router.get('/drones', authenticate, (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'B-DRN-001', model: 'Agras T40', status: 'Active', battery: 85 },
            { id: 'B-DRN-002', model: 'Agras T20', status: 'Maintenance', battery: 20 },
            { id: 'B-DRN-003', model: 'Agras T40', status: 'Charging', battery: 12 },
            { id: 'B-DRN-004', model: 'Agras T20', status: 'Active', battery: 90 },
            { id: 'B-DRN-005', model: 'Agras T40', status: 'Available', battery: 100 }
        ]
    });
});

router.get('/dronePilots', authenticate, (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'P001', name: 'Ravi Kumar', status: 'On Mission', rating: 4.8 },
            { id: 'P002', name: 'Suresh Patel', status: 'Available', rating: 4.9 },
            { id: 'P003', name: 'Amit Singh', status: 'Off Duty', rating: 4.5 },
            { id: 'P004', name: 'Vikram Reddy', status: 'On Mission', rating: 4.7 }
        ]
    });
});

router.get('/weather', authenticate, (req, res) => {
    res.json({
        success: true,
        data: [
            { region: 'Vijayawada North', condition: 'Clear', wind: '5 km/h', temp: '32°C', suitable: true },
            { region: 'Guntur Rural', condition: 'Rain', wind: '15 km/h', temp: '28°C', suitable: false },
            { region: 'Amaravati Fields', condition: 'Cloudy', wind: '8 km/h', temp: '30°C', suitable: true }
        ]
    });
});

router.get('/reports', authenticate, (req, res) => {
    res.json({
        success: true,
        data: [
            { date: '2026-07-14', totalSprayedAcres: 45, activePilots: 2, issuesReported: 0 },
            { date: '2026-07-13', totalSprayedAcres: 55, activePilots: 3, issuesReported: 1 },
            { date: '2026-07-12', totalSprayedAcres: 40, activePilots: 2, issuesReported: 0 }
        ]
    });
});

module.exports = router;
