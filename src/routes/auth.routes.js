const express = require("express");
const {
  sendOtp,
  verifyOtp,
  loginAdmin,
  registerAdmin,
  checkBanStatus,
  toggleBanByPhone,
} = require("../controllers/auth.controller");
const {
  sendOtpSchema,
  verifyOtpSchema,
} = require("../validations/authValidation");
const router = express.Router();
const validateRequest = require("../middleware/validateRequest");

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post("/send-otp", validateRequest(sendOtpSchema), sendOtp);
router.post("/verify-otp", validateRequest(verifyOtpSchema), verifyOtp);
router.post("/check-ban", checkBanStatus);
router.post("/toggle-ban", toggleBanByPhone);

module.exports = router;
