const fetch = require("node-fetch");

exports.getAcreageTrend = async (req, res) => {
    try {
        const { start, end, interval } = req.query;
        const token = process.env.BHUMEET_TOKEN;
        
        if (!token) {
            return res.status(500).json({ error: "BHUMEET_TOKEN not configured" });
        }

        const response = await fetch(
            `https://api.bhumeet.app/dsp/acreage/total-acreage/${start}/${end}/${interval}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (!response.ok) {
            const errBody = await response.text();
            return res.status(response.status).send(errBody);
        }
        
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Acreage trend error:", error.message);
        res.status(500).json({ error: "Failed to fetch acreage trend" });
    }
};
