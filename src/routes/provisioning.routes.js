const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  getProvisioningPayload,
  downloadProvisioningApk,
  getProvisioningInfo,
} = require("../controllers/provisioning.controller");
const { DEFAULT_APK_FILENAME } = require("../services/provisioning.service");

const router = express.Router();

// Public — customer phone downloads APK during Android setup (must be HTTPS in prod)
router.get(`/apk/${DEFAULT_APK_FILENAME}`, downloadProvisioningApk);

// Dealer app — auth required for QR payload with loan binding
router.get("/payload", authMiddleware, getProvisioningPayload);
router.get("/info", authMiddleware, getProvisioningInfo);

module.exports = router;
