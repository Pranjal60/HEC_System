const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/ambulanceController");
const { authenticate } = require("../middleware/auth");

router.get("/",                 ctrl.getAll);
router.post("/find-suitable",   ctrl.findSuitable);     // before /:id
router.post("/assign-nearest",  ctrl.assignNearest);    // before /:id
router.get("/:id",              ctrl.getById);
router.post("/",                authenticate, ctrl.create);
router.put("/:id/status",       authenticate, ctrl.updateStatus);
router.put("/:id",              authenticate, ctrl.update);
router.delete("/:id",           authenticate, ctrl.remove);
router.post("/:id/release",     authenticate, ctrl.release);

module.exports = router;
