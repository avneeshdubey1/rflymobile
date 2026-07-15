const { fetchGoogleFormData } = require("../services/googleFormService");

exports.syncGoogleForms = async(req, res) => {
    try {
        const forms = await fetchGoogleFormData();

        res.status(200).json({
            success: true,
            count: forms.length,
            data: forms,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};