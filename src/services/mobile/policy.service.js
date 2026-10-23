const DevicePolicy = require("../../models/DevicePolicy.model");

const DEFAULT_POLICY = {
  scope: "global",
  deviceLockPolicy: { lockOnOverdue: true, gracePeriodDays: 3 },
  camera: true,
  microphone: true,
  usb: true,
  factoryReset: false,
  gps: true,
  wifi: true,
  bluetooth: true,
  calls: true,
  sms: true,
  appBlacklist: [],
  appWhitelist: [],
  allowedSettings: [],
  restrictedSettings: ["developer_options"],
  version: 1,
  isActive: true,
};

/** Ensure a single global default policy exists. */
const ensureGlobalPolicy = async () => {
  let global = await DevicePolicy.findOne({ scope: "global" });
  if (!global) {
    global = await DevicePolicy.create(DEFAULT_POLICY);
  }
  return global;
};

const toPayload = (doc) => ({
  deviceLockPolicy: doc.deviceLockPolicy,
  camera: doc.camera,
  microphone: doc.microphone,
  usb: doc.usb,
  factoryReset: doc.factoryReset,
  gps: doc.gps,
  wifi: doc.wifi,
  bluetooth: doc.bluetooth,
  calls: doc.calls,
  sms: doc.sms,
  appBlacklist: doc.appBlacklist || [],
  appWhitelist: doc.appWhitelist || [],
  allowedSettings: doc.allowedSettings || [],
  restrictedSettings: doc.restrictedSettings || [],
  version: doc.version,
  scope: doc.scope,
});

/**
 * Resolve the effective policy for a device.
 * Most specific wins: device override → dealer policy → global default.
 */
const resolvePolicy = async ({ deviceId, dealerId }) => {
  if (deviceId) {
    const devicePolicy = await DevicePolicy.findOne({
      scope: "device",
      deviceId,
      isActive: true,
    });
    if (devicePolicy) return toPayload(devicePolicy);
  }

  if (dealerId) {
    const dealerPolicy = await DevicePolicy.findOne({
      scope: "dealer",
      ownerId: dealerId,
      isActive: true,
    });
    if (dealerPolicy) return toPayload(dealerPolicy);
  }

  const global = await ensureGlobalPolicy();
  return toPayload(global);
};

module.exports = { ensureGlobalPolicy, resolvePolicy, DEFAULT_POLICY, toPayload };
