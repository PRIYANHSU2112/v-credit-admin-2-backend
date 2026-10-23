const express = require("express");
const router = express.Router();

const validate = require("../middleware/validateRequest");
const mobileAuth = require("../middleware/mobileAuth.middleware");

const authCtrl = require("../controllers/mobile/mobileAuth.controller");
const profileCtrl = require("../controllers/mobile/profile.controller");
const activationCtrl = require("../controllers/mobile/activation.controller");
const deviceCtrl = require("../controllers/mobile/device.controller");
const commandCtrl = require("../controllers/mobile/command.controller");

const v = require("../validations/mobileValidation");

// ─── Auth (public) ───
router.post("/auth/request-otp", validate(v.requestOtpSchema), authCtrl.requestOtp);
router.post("/auth/login", validate(v.loginSchema), authCtrl.login);
router.post("/auth/refresh", validate(v.refreshSchema), authCtrl.refresh);
router.post("/auth/logout", validate(v.logoutSchema), authCtrl.logout);

// ─── Everything below requires a valid mobile access token ───
router.use(mobileAuth);

// STEP 3: bootstrap profile + assigned key + dealer + org
router.get("/me", profileCtrl.bootstrap);

// STEP 4/9: device registration + session
router.post("/device/register", validate(v.registerDeviceSchema), deviceCtrl.register);

// STEP 5/6/7: activate assigned key on this device (returns policy)
router.post("/activate", validate(v.activateSchema), activationCtrl.activate);

// STEP 7: fetch effective device policy
router.get("/device/:deviceId/policy", deviceCtrl.policy);

// STEP 10: heartbeat
router.post("/heartbeat", validate(v.heartbeatSchema), deviceCtrl.heartbeat);

// STEP 11: remote command poll + ack (device side)
router.get("/device/:deviceId/commands", commandCtrl.poll);
router.post("/commands/ack", validate(v.commandAckSchema), commandCtrl.ack);

// Device status (self)
router.get("/device/:deviceId/status", deviceCtrl.status);

module.exports = router;
