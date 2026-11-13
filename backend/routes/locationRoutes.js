const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/locationController");

// GET /api/locations  — public, no auth needed (used by dropdowns)
router.get("/", ctrl.getAll);

module.exports = router;
