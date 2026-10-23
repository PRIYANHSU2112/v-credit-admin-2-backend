const mongoose = require("mongoose");
const EnterpriseKey = require("../../models/EnterpriseKey.model");
const Device = require("../../models/Device.model");
const Customer = require("../../models/Customer.model");
const User = require("../../models/UserModel");
const ActivationHistory = require("../../models/ActivationHistory.model");
const { recalculateInventory } = require("../inventory.service");
const { createAuditLog } = require("../audit.service");
const { resolveHierarchy } = require("./hierarchy.helper");
const { resolvePolicy } = require("./policy.service");
const { notify } = require("./notify.service");

const { AVAILABLE_STATUSES } = EnterpriseKey;
const DEFAULT_VALIDITY_DAYS = parseInt(process.env.KEY_VALIDITY_DAYS || "365", 10);

const normalizePhone = (phone = "") => phone.replace(/\D/g, "").slice(-10);

/**
 * Custom error carrying a machine-readable code for the mobile client.
 */
class ActivationError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * STEP (dealer/loan side): reserve one available key for a customer at loan creation.
 * Transitions an available key → "Assigned", stamps the hierarchy + IMEI.
 * Returns the assigned key, or null if the dealer has no EnterpriseKey stock
 * (legacy dealers may only track the numeric `user.keys` balance).
 */
const assignKeyForLoan = async ({
  loanId,
  customerId,
  dealerUserId,
  imei,
  performedBy,
  expiryDate,
  session,
}) => {
  const key = await EnterpriseKey.findOne({
    currentOwnerId: dealerUserId,
    status: { $in: AVAILABLE_STATUSES },
    assignedToCustomerId: { $in: [null, undefined] },
    isDeleted: false,
  }).session(session || null);

  if (!key) return null;

  const hierarchy = await resolveHierarchy(dealerUserId);

  key.status = "Assigned";
  key.assignedToCustomerId = customerId;
  key.activatedForLoanId = loanId;
  key.assignedAt = new Date();
  key.imei = imei || key.imei;
  key.dealerId = hierarchy.dealerId || dealerUserId;
  key.distributorId = hierarchy.distributorId;
  key.stockistId = hierarchy.stockistId;
  key.expiryDate =
    expiryDate ||
    new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  key.history.push({
    action: "assigned",
    performedBy,
    toUserId: dealerUserId,
    note: `Assigned to customer ${customerId}${imei ? ` (IMEI ${imei})` : ""}`,
  });
  await key.save({ session });

  await ActivationHistory.create(
    [
      {
        event: "ASSIGNED",
        keyId: key._id,
        keyNumber: key.keyNumber,
        customerId,
        loanId,
        imei,
        dealerId: key.dealerId,
        distributorId: key.distributorId,
        stockistId: key.stockistId,
        performedBy,
      },
    ],
    { session: session || undefined },
  );

  return key;
};

/**
 * Resolve the Customer document for a logged-in mobile User (mapped by phone).
 */
const resolveCustomerForUser = async (user) => {
  if (!user) return null;
  const phone = normalizePhone(user.phone || "");
  if (!phone) return null;
  return Customer.findOne({
    customerMobileNumber: { $regex: `${phone}$` },
  });
};

/**
 * STEP 5 + 6 (mobile side): verify + activate the assigned key for a device.
 * Binds IMEI / Android ID / deviceId, transitions Assigned → Activated,
 * registers the device, updates inventory, writes audit + activation history,
 * and returns the effective device policy.
 */
const activateForDevice = async ({
  user,
  deviceInfo,
  performedBy,
  req,
}) => {
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
  } = deviceInfo || {};

  const deviceId = imei || androidId;
  if (!deviceId) {
    throw new ActivationError("MISSING_DEVICE_ID", "IMEI or Android ID required");
  }

  // Integrity gate
  if (isRooted || isEmulator) {
    throw new ActivationError(
      "DEVICE_INTEGRITY_FAILED",
      "Rooted or emulator devices are not allowed",
      403,
    );
  }

  // Blacklist gate
  const existingDevice = await Device.findOne({ deviceId });
  if (existingDevice && existingDevice.isBlacklisted) {
    throw new ActivationError("DEVICE_BLACKLISTED", "This device is blacklisted", 403);
  }

  // Resolve customer
  const customer = await resolveCustomerForUser(user);
  if (!customer) {
    throw new ActivationError("CUSTOMER_NOT_FOUND", "Customer profile not found", 404);
  }

  // Find the key assigned to this customer
  const key = await EnterpriseKey.findOne({
    assignedToCustomerId: customer._id,
    status: { $in: ["Assigned", "Activated"] },
    isDeleted: false,
  }).sort({ assignedAt: -1 });

  if (!key) {
    throw new ActivationError(
      "NO_KEY_ASSIGNED",
      "No key assigned to this customer. Contact your dealer.",
      404,
    );
  }

  // Idempotent duplicate activation: same key already activated for same device → OK
  if (key.status === "Activated") {
    if (key.deviceId && key.deviceId === deviceId) {
      const policy = await resolvePolicy({ deviceId, dealerId: key.dealerId });
      return { key, alreadyActive: true, policy };
    }
    throw new ActivationError(
      "KEY_BOUND_TO_OTHER_DEVICE",
      "This key is already activated on another device",
      409,
    );
  }

  // Expiry gate
  if (key.expiryDate && key.expiryDate < new Date()) {
    throw new ActivationError("KEY_EXPIRED", "Assigned key has expired", 410);
  }

  // IMEI consistency (dealer may have recorded IMEI at loan time)
  if (key.imei && imei && key.imei !== imei) {
    throw new ActivationError(
      "IMEI_MISMATCH",
      "Device IMEI does not match the loan record",
      409,
    );
  }

  // IMEI uniqueness — must not be bound to another active key
  if (imei) {
    const conflict = await EnterpriseKey.findOne({
      _id: { $ne: key._id },
      imei,
      status: "Activated",
      isDeleted: false,
    });
    if (conflict) {
      throw new ActivationError(
        "IMEI_ALREADY_REGISTERED",
        "This IMEI is already registered to another key",
        409,
      );
    }
  }

  const hierarchy = await resolveHierarchy(key.currentOwnerId);
  const now = new Date();
  const expiryDate =
    key.expiryDate ||
    new Date(now.getTime() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  // ── Transition key: Assigned → Activated ──
  key.status = "Activated";
  key.activationDate = now;
  key.expiryDate = expiryDate;
  key.activatedForCustomerId = customer._id;
  key.imei = imei || key.imei;
  key.androidId = androidId;
  key.deviceId = deviceId;
  key.fcmToken = fcmToken;
  key.dealerId = key.dealerId || hierarchy.dealerId || key.currentOwnerId;
  key.distributorId = key.distributorId || hierarchy.distributorId;
  key.stockistId = key.stockistId || hierarchy.stockistId;
  key.history.push({
    action: "activated",
    performedBy,
    note: `Device ${deviceId} activated`,
  });
  await key.save();

  // ── Register / bind the device ──
  const deviceUpdate = {
    deviceId,
    customerId: customer._id,
    loanId: key.activatedForLoanId,
    keyId: key._id,
    dealerId: key.dealerId,
    distributorId: key.distributorId,
    stockistId: key.stockistId,
    imei1: imei,
    androidId,
    deviceModel,
    brand,
    manufacturer,
    androidVersion,
    securityPatch,
    fcmToken,
    simInfo,
    isRooted: !!isRooted,
    isEmulator: !!isEmulator,
    status: "ACTIVATED",
    activatedAt: now,
    appVersion,
    lastSync: now,
    heartbeatAt: now,
  };
  if (permissions) deviceUpdate.permissions = permissions;

  const device = await Device.findOneAndUpdate({ deviceId }, deviceUpdate, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  // ── Inventory + audit + history + notifications ──
  if (key.currentOwnerId) {
    await recalculateInventory(key.currentOwnerId).catch((e) =>
      console.error("Inventory recalc failed:", e.message),
    );
  }

  await ActivationHistory.create({
    event: "ACTIVATED",
    keyId: key._id,
    keyNumber: key.keyNumber,
    customerId: customer._id,
    loanId: key.activatedForLoanId,
    deviceId,
    imei,
    androidId,
    dealerId: key.dealerId,
    distributorId: key.distributorId,
    stockistId: key.stockistId,
    performedBy,
  });

  await createAuditLog({
    action: "Key activated on device",
    userId: performedBy,
    role: "customer",
    target: key.keyNumber,
    targetId: key._id,
    severity: "success",
    metadata: { deviceId, imei, androidId, customerId: customer._id },
    req,
  });

  // Notify dealer + customer
  if (key.dealerId) {
    await notify({
      userId: key.dealerId,
      title: "Activation success",
      body: `Key ${key.keyNumber} activated for ${customer.customerName || "customer"}`,
      data: { type: "ACTIVATION_SUCCESS", keyNumber: key.keyNumber, deviceId },
    });
  }
  await notify({
    userId: user._id,
    title: "Device activated",
    body: "Your device has been activated successfully.",
    data: { type: "ACTIVATION_SUCCESS", keyNumber: key.keyNumber },
    fcmToken,
  });

  const policy = await resolvePolicy({ deviceId, dealerId: key.dealerId });

  return { key, device, customer, policy, alreadyActive: false };
};

/**
 * STEP 12: expiry sweep. Marks activated keys past expiry as "Expired",
 * flags the device, and notifies the customer/dealer. Safe to run on a cron.
 */
const checkAndExpireKeys = async () => {
  const now = new Date();
  const expiring = await EnterpriseKey.find({
    status: "Activated",
    expiryDate: { $lt: now },
    isDeleted: false,
  });

  let count = 0;
  for (const key of expiring) {
    key.status = "Expired";
    key.history.push({ action: "expired", note: "Auto expiry" });
    await key.save();

    if (key.deviceId) {
      await Device.updateOne(
        { deviceId: key.deviceId },
        { status: "EXPIRED" },
      );
    }

    await ActivationHistory.create({
      event: "EXPIRED",
      keyId: key._id,
      keyNumber: key.keyNumber,
      customerId: key.activatedForCustomerId,
      deviceId: key.deviceId,
      dealerId: key.dealerId,
      distributorId: key.distributorId,
      stockistId: key.stockistId,
    });

    if (key.currentOwnerId) {
      await recalculateInventory(key.currentOwnerId).catch(() => {});
    }
    if (key.dealerId) {
      await notify({
        userId: key.dealerId,
        title: "Key expired",
        body: `Key ${key.keyNumber} has expired.`,
        data: { type: "KEY_EXPIRED", keyNumber: key.keyNumber },
      });
    }
    count += 1;
  }
  return { expired: count };
};

module.exports = {
  ActivationError,
  assignKeyForLoan,
  activateForDevice,
  resolveCustomerForUser,
  checkAndExpireKeys,
  normalizePhone,
};
