const express = require("express");
const router = express.Router();
const { submitForm } = require("../controllers/submitController");

router.post("/submit", submitForm);

module.exports = router;
