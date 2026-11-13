const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/billingController");
const { authenticate } = require("../middleware/auth");

router.get("/bills",      authenticate, ctrl.getBills);
router.get("/bills/:id",  authenticate, ctrl.getBillById);
router.post("/bills",     authenticate, ctrl.createBill);
router.put("/bills/:id",  authenticate, ctrl.updateBill);
router.get("/payments",   authenticate, ctrl.getPayments);
router.post("/payments",  authenticate, ctrl.createPayment);

module.exports = router;
