const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/doctorController");
const { authenticate } = require("../middleware/auth");

router.get("/",            ctrl.getAll);
router.get("/:id",         ctrl.getById);
router.post("/",           authenticate, ctrl.create);
router.put("/:id/assign",  authenticate, ctrl.assign);
router.put("/:id/release", authenticate, ctrl.release);
router.put("/:id",         authenticate, ctrl.update);
router.delete("/:id",      authenticate, ctrl.remove);

module.exports = router;
