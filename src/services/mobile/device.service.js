const Device = require("../../models/Device.model");
const EnterpriseKey = require("../../models/EnterpriseKey.model");

/**
 * STEP 4/9: register (or update) a device record with hardware, permission and
 * session information. Used both before activation (status PENDING/REGISTERED)
 * and to refresh device metadata afterwards. Does NOT activate a key.
 */
const registerDevice = async ({ customerId, deviceInfo }) => {
  const {
    imei,
    androidId,
    fcmToken,
    deviceModel,
    brand,
    manufacturer,
    androidVersion,
    securityPatch,
    simInfo,
    permissions,
    isRooted,
    isEmulator,
    appVersion,
    ip,
    networkType,
    battery,
  } = deviceInfo || {};

  const deviceId = imei || androidId;
  if (!deviceId) throw new Error("IMEI or Android ID required");

  const existing = await Device.findOne({ deviceId });
  const nextStatus =
    existing && existing.status === "ACTIVATED" ? "ACTIVATED" : "REGISTERED";

  const update = {
    deviceId,
    customerId,
    imei1: imei,
    androidId,
    fcmToken,
    deviceModel,
    brand,
    manufacturer,
    androidVersion,
    securityPatch,
    simInfo,
    appVersion,
    status: nextStatus,
    lastSync: new Date(),
    "session.lastSeen": new Date(),
    "session.currentIp": ip,
    "session.networkType": networkType,
    "session.battery": battery,
    "session.appVersion": appVersion,
    "session.onlineStatus": true,
  };
  if (permissions) update.permissions = permissions;
  if (typeof isRooted === "boolean") update.isRooted = isRooted;
  if (typeof isEmulator === "boolean") update.isEmulator = isEmulator;

  const device = await Device.findOneAndUpdate({ deviceId }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return device;
};

/**
 * STEP 10: process a heartbeat. Updates live session telemetry and returns
 * the current server-side directives (lock status + whether commands are pending).
 */
const processHeartbeat = async ({ deviceId, telemetry = {} }) => {
  const now = new Date();

  // Build a $set of only the dotted session paths we actually have, so we never
  // write `undefined` into nested subpaths (which Mongoose rejects on cast).
  const set = {
    heartbeatAt: now,
    "session.lastSeen": now,
    "session.lastSync": now,
    "session.onlineStatus": true,
  };
  if (telemetry.battery !== undefined) set["session.battery"] = telemetry.battery;
  if (telemetry.ip !== undefined) set["session.currentIp"] = telemetry.ip;
  if (telemetry.networkType !== undefined) set["session.networkType"] = telemetry.networkType;
  if (telemetry.currentScreen !== undefined) set["session.currentScreen"] = telemetry.currentScreen;
  if (telemetry.appVersion !== undefined) {
    set["session.appVersion"] = telemetry.appVersion;
    set.appVersion = telemetry.appVersion;
  }
  if (telemetry.location) set["session.location"] = telemetry.location;

  const device = await Device.findOneAndUpdate({ deviceId }, { $set: set }, { new: true });
  if (!device) throw new Error("Device not found");

  // Report key expiry state back to the device
  let keyStatus = null;
  let expiryDate = null;
  if (device.keyId) {
    const key = await EnterpriseKey.findById(device.keyId).select(
      "status expiryDate",
    );
    if (key) {
      keyStatus = key.status;
      expiryDate = key.expiryDate;
    }
  }

  return {
    deviceId,
    isLocked: device.isLocked,
    lockStatus: device.lockStatus,
    status: device.status,
    keyStatus,
    expiryDate,
    serverTime: now,
  };
};

const getDeviceStatus = async (deviceId) => {
  const device = await Device.findOne({ deviceId })
    .populate("keyId", "keyNumber status expiryDate activationDate")
    .populate("customerId", "customerName customerMobileNumber");
  if (!device) throw new Error("Device not found");
  return device;
};

module.exports = { registerDevice, processHeartbeat, getDeviceStatus };
