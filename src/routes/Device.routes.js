const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/Device.controller");

// Register registraiton endpoint (called by App on first launch)
router.post("/register", deviceController.registerDevice);

// Control endpoints
router.post("/lock", deviceController.lockDevice);
router.post("/unlock", deviceController.unlockDevice);
router.get("/status/:deviceId", deviceController.getDeviceStatus);

module.exports = router;
