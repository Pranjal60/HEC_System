const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/schedulingController");
const { authenticate } = require("../middleware/auth");

router.get("/status", ctrl.status);
router.get("/logs",   authenticate, ctrl.logs);
router.post("/run",   authenticate, ctrl.run);

module.exports = router;
