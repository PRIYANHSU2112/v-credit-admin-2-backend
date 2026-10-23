const mongoose = require("mongoose");
const Device = require("../../models/Device.model");
const DevicePolicy = require("../../models/DevicePolicy.model");
const ActivationHistory = require("../../models/ActivationHistory.model");
const { getDescendantIds } = require("../../services/hierarchyTree.service");
const { checkAndExpireKeys } = require("../../services/mobile/activation.service");
const { createAuditLog } = require("../../services/audit.service");

// Build the set of user ids (self + descendants) a given actor may see.
const scopeOwnerIds = async (actor) => {
  if (!actor || actor.enterpriseRole === "super_admin") return null; // null = all
  const ids = [actor._id];
  if (actor.enterpriseRole !== "dealer") {
    const desc = await getDescendantIds(actor._id);
    ids.push(...desc.map((id) => new mongoose.Types.ObjectId(id)));
  }
  return ids;
};

// List devices visible to the actor.
const listDevices = async (req, res) => {
  try {
    const ownerIds = await scopeOwnerIds(req.enterpriseUser);
    const filter = {};
    if (ownerIds) {
      filter.$or = [
        { dealerId: { $in: ownerIds } },
        { distributorId: { $in: ownerIds } },
        { stockistId: { $in: ownerIds } },
      ];
    }
    if (req.query.status) filter.status = req.query.status;

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const [devices, total] = await Promise.all([
      Device.find(filter)
        .populate("customerId", "customerName customerMobileNumber")
        .populate("keyId", "keyNumber status expiryDate")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Device.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: devices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDevice = async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId })
      .populate("customerId", "customerName customerMobileNumber")
      .populate("keyId", "keyNumber status expiryDate activationDate");
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Blacklist / unblacklist a device.
const setBlacklist = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { blacklisted, reason } = req.body;
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { isBlacklisted: !!blacklisted, blacklistReason: reason || null },
      { new: true },
    );
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    await createAuditLog({
      action: blacklisted ? "Device blacklisted" : "Device un-blacklisted",
      userId: req.userId,
      role: req.enterpriseRole,
      target: deviceId,
      severity: blacklisted ? "warning" : "info",
      req,
    });
    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Upsert a policy (scope = global | dealer | device).
const upsertPolicy = async (req, res) => {
  try {
    const { scope, deviceId, ownerId, ...fields } = req.body;
    if (!["global", "dealer", "device"].includes(scope)) {
      return res.status(400).json({ success: false, message: "Invalid scope" });
    }
    const query = { scope };
    if (scope === "device") query.deviceId = deviceId;
    if (scope === "dealer") query.ownerId = ownerId || req.userId;

    const update = { ...fields, scope, ...query, $inc: { version: 1 } };
    const policy = await DevicePolicy.findOneAndUpdate(query, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getPolicies = async (req, res) => {
  try {
    const filter = {};
    if (req.query.scope) filter.scope = req.query.scope;
    const policies = await DevicePolicy.find(filter).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: policies });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Activation history feed (scoped).
const activationHistory = async (req, res) => {
  try {
    const ownerIds = await scopeOwnerIds(req.enterpriseUser);
    const filter = {};
    if (ownerIds) {
      filter.$or = [
        { dealerId: { $in: ownerIds } },
        { distributorId: { $in: ownerIds } },
        { stockistId: { $in: ownerIds } },
      ];
    }
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const history = await ActivationHistory.find(filter)
      .populate("customerId", "customerName")
      .sort({ createdAt: -1 })
      .limit(limit);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Manually trigger the key-expiry sweep (also runs on cron).
const runExpirySweep = async (req, res) => {
  try {
    const result = await checkAndExpireKeys();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listDevices,
  getDevice,
  setBlacklist,
  upsertPolicy,
  getPolicies,
  activationHistory,
  runExpirySweep,
};
