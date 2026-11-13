const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/treatmentController");
const { authenticate } = require("../middleware/auth");

router.get("/",    authenticate, ctrl.getAll);
router.get("/:id", authenticate, ctrl.getById);
router.post("/",   authenticate, ctrl.create);
router.put("/:id", authenticate, ctrl.update);

module.exports = router;
