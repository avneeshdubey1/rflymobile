const axios = require('axios');

let bhumeetToken = null;
let tokenExpiresAt = 0;

const getBhumeetToken = async () => {
    if (bhumeetToken && Date.now() < tokenExpiresAt) {
        return bhumeetToken;
    }
    try {
        console.log("Authenticating with Bhumeet API...");
        const res = await axios.post('https://api.bhumeet.app/dsp/login', {
            email: process.env.BHUMEET_EMAIL,
            password: process.env.BHUMEET_PASSWORD
        });
        
        // Handle various possible token response shapes
        bhumeetToken = res.data?.token || res.data?.accessToken || res.data?.data?.token || res.data?.data?.accessToken;
        
        if (!bhumeetToken) {
            console.error("Failed to extract token from response:", res.data);
            throw new Error("Token not found in response");
        }

        tokenExpiresAt = Date.now() + 1000 * 60 * 60; // Cache for 1 hour
        return bhumeetToken;
    } catch (e) {
        console.error("Bhumeet Login failed", e.response?.data || e.message);
        throw e;
    }
};

exports.proxyRequest = async (req, res) => {
    try {
        console.log(`[Bhumeet Mock] ${req.method} ${req.path}`);
        
        switch (req.path) {
            case '/dsp/overview':
                return res.json({
                    success: true,
                    data: {
                        totalDrones: 27,
                        totalPilots: 9,
                        activeMissions: 4,
                        pendingMaintenance: 2,
                        revenueThisMonth: "$12,450"
                    }
                });
            case '/dsp/drones':
                return res.json({
                    success: true,
                    data: [
                        { id: 'B-DRN-001', model: 'Agras T40', status: 'Active', battery: 85 },
                        { id: 'B-DRN-002', model: 'Agras T20', status: 'Maintenance', battery: 20 },
                        { id: 'B-DRN-003', model: 'Agras T40', status: 'Charging', battery: 12 },
                        { id: 'B-DRN-004', model: 'Agras T20', status: 'Active', battery: 90 }
                    ]
                });
            case '/dsp/dronePilots':
                return res.json({
                    success: true,
                    data: [
                        { id: 'P001', name: 'John Doe', status: 'On Mission', rating: 4.8 },
                        { id: 'P002', name: 'Jane Smith', status: 'Available', rating: 4.9 },
                        { id: 'P003', name: 'Bob Wilson', status: 'Off Duty', rating: 4.5 }
                    ]
                });
            case '/dsp/weather':
                return res.json({
                    success: true,
                    data: [
                        { region: 'Farm Zone A', condition: 'Clear', wind: '5 km/h', temp: '24°C', suitable: true },
                        { region: 'Farm Zone B', condition: 'Rain', wind: '15 km/h', temp: '18°C', suitable: false },
                        { region: 'Farm Zone C', condition: 'Cloudy', wind: '8 km/h', temp: '22°C', suitable: true }
                    ]
                });
            case '/dsp/reports':
                return res.json({
                    success: true,
                    data: [
                        { date: '2026-07-09', totalSprayedAcres: 120, activePilots: 4, issuesReported: 0 },
                        { date: '2026-07-08', totalSprayedAcres: 150, activePilots: 5, issuesReported: 1 },
                        { date: '2026-07-07', totalSprayedAcres: 90, activePilots: 3, issuesReported: 0 }
                    ]
                });
            default:
                return res.status(404).json({ success: false, message: "Mock endpoint not found" });
        }
    } catch (error) {
        console.error(`[Bhumeet Mock Error]`, error);
        res.status(500).json({ success: false, message: "Mock error" });
    }
};
