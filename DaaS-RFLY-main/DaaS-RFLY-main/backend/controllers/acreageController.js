const axios = require("axios");
const getBhumeetToken = require("../utils/bhumeetAuth");

exports.getAcreageTrend = async(req, res) => {
    try {
        const {
            start,
            end,
            interval,
            droneId
        } = req.query;
        const token = await getBhumeetToken();
        const response = await axios.get(
            `https://api.bhumeet.app/dsp/acreage/total-acreage/${start}/${end}/${interval}`, {
                // params: {
                //     droneId: droneId
                // },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        res.status(200).json(response.data);
    } catch (error) {
        console.log("========== ERROR ==========");
        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Response:", error.response.data);

            return res.status(error.response.status)
                .json(error.response.data);
        }
        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};