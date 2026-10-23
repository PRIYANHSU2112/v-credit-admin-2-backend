const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const { loadEnterpriseUser, requireEnterpriseRole } = require("../middleware/enterprise.middleware");
const validate = require("../middleware/validateRequest");

const mdmCtrl = require("../controllers/mobile/mdm.controller");
const commandCtrl = require("../controllers/mobile/command.controller");
const v = require("../validations/mobileValidation");

// All MDM admin endpoints require an authenticated enterprise user.
router.use(authMiddleware, loadEnterpriseUser);

// Device registry
router.get("/devices", mdmCtrl.listDevices);
router.get("/devices/:deviceId", mdmCtrl.getDevice);
router.patch("/devices/:deviceId/blacklist", mdmCtrl.setBlacklist);

// Remote commands (issue). Only dealer and above may issue.
router.post(
  "/commands",
  requireEnterpriseRole("super_admin", "stockist", "distributor", "dealer"),
  validate(v.commandIssueSchema),
  commandCtrl.issue,
);

// Policies
router.get("/policies", mdmCtrl.getPolicies);
router.post(
  "/policies",
  requireEnterpriseRole("super_admin", "stockist", "distributor", "dealer"),
  mdmCtrl.upsertPolicy,
);

// Activation history + expiry sweep
router.get("/activation-history", mdmCtrl.activationHistory);
router.post(
  "/expiry-sweep",
  requireEnterpriseRole("super_admin"),
  mdmCtrl.runExpirySweep,
);

module.exports = router;
