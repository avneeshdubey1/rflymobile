const axios = require("axios");

const GOOGLE_FORM_API =
    "https://script.google.com/macros/s/AKfycbyO35E0s98i8iiu3kFVEgHwiDIK7SlX-N7v6fdE915T9Pd08gcPIf8NyFOlvjMYA2I/exec";

async function fetchGoogleFormData() {
    const response = await axios.get(GOOGLE_FORM_API);
    return response.data;
}

module.exports = {
    fetchGoogleFormData,
};