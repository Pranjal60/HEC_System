const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login",    ctrl.login);
router.post("/register", ctrl.register);
router.get("/me",        authenticate, ctrl.me);

module.exports = router;
