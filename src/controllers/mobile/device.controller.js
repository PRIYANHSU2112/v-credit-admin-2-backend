const {
  registerDevice,
  processHeartbeat,
  getDeviceStatus,
} = require("../../services/mobile/device.service");
const {
  resolveCustomerForUser,
} = require("../../services/mobile/activation.service");
const { resolvePolicy } = require("../../services/mobile/policy.service");
const Device = require("../../models/Device.model");

// STEP 4/9: register / update device metadata + session (pre or post activation).
const register = async (req, res) => {
  try {
    const customer = await resolveCustomerForUser(req.mobileUser);
    const device = await registerDevice({
      customerId: customer?._id,
      deviceInfo: { ...req.body, ip: req.ip },
    });
    return res
      .status(200)
      .json({ success: true, message: "Device registered", data: device });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// STEP 10: heartbeat every 30s → returns lock state + key status directives.
const heartbeat = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const directives = await processHeartbeat({
      deviceId,
      telemetry: { ...req.body, ip: req.ip },
    });
    return res.status(200).json({ success: true, data: directives });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
};

// STEP 7: fetch effective device policy.
const policy = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    const effective = await resolvePolicy({ deviceId, dealerId: device.dealerId });
    return res.status(200).json({ success: true, data: effective });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const status = async (req, res) => {
  try {
    const device = await getDeviceStatus(req.params.deviceId);
    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
};

module.exports = { register, heartbeat, policy, status };
