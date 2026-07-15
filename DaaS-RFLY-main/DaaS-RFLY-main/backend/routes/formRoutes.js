const express = require("express");
const router = express.Router();

const {
    syncGoogleForms,
} = require("../controllers/formController");

router.get("/sync", syncGoogleForms);

module.exports = router;