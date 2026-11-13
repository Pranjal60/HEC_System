const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/emergencyController");
const { authenticate } = require("../middleware/auth");

router.get("/dashboard/stats",        ctrl.dashboardStats);
router.post("/quick-dispatch",        authenticate, ctrl.quickDispatch);
router.post("/demo-cleanup",          authenticate, ctrl.demoCleanup);
router.get("/",                       ctrl.getAll);
router.get("/:id",                    ctrl.getById);
router.post("/",                      authenticate, ctrl.create);
router.put("/:id",                    authenticate, ctrl.update);
router.post("/:id/assign-nearest",    ctrl.assignNearestAmbulance);

module.exports = router;
