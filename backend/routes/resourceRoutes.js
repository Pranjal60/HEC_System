const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/resourceController");
const { authenticate } = require("../middleware/auth");

router.get("/status",              ctrl.status);
router.get("/logs",                authenticate, ctrl.logs);
router.post("/request",            authenticate, ctrl.request);
router.post("/release",            authenticate, ctrl.release);
router.post("/cancel",             authenticate, ctrl.cancel);
router.post("/deadlock",           ctrl.deadlock);
router.post("/starvation-tick",    ctrl.starvationTick);
router.post("/semaphore",          ctrl.semaphoreDemo);

module.exports = router;
