const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true, // IMEI or Android ID (primary device identifier)
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
    },
    keyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EnterpriseKey",
    },
    // Hierarchy snapshot for fast scoping
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stockistId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ─── Device hardware / OS info ───
    imei1: { type: String, trim: true, index: true },
    imei2: { type: String, trim: true },
    androidId: { type: String, trim: true, index: true },
    deviceModel: { type: String, trim: true },
    brand: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    androidVersion: { type: String, trim: true },
    securityPatch: { type: String, trim: true },
    fcmToken: { type: String },
    simInfo: { type: mongoose.Schema.Types.Mixed },

    // ─── Permission / capability status ───
    permissions: {
      batteryOptimization: { type: Boolean, default: false },
      accessibility: { type: Boolean, default: false },
      overlay: { type: Boolean, default: false },
      usageStats: { type: Boolean, default: false },
      notification: { type: Boolean, default: false },
      location: { type: Boolean, default: false },
    },

    // ─── Integrity / security ───
    isRooted: { type: Boolean, default: false },
    isEmulator: { type: Boolean, default: false },
    isBlacklisted: { type: Boolean, default: false },
    blacklistReason: { type: String },

    // ─── Lock state ───
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockStatus: {
      type: String,
      enum: ["LOCKED", "UNLOCKED", "GracePeriod"],
      default: "UNLOCKED",
    },
    isDeveloperOptionsBlocked: {
      type: Boolean,
      default: true,
    },

    // ─── Activation / registration state ───
    status: {
      type: String,
      enum: ["PENDING", "REGISTERED", "ACTIVATED", "EXPIRED", "REVOKED"],
      default: "PENDING",
      index: true,
    },
    activatedAt: { type: Date },

    // ─── Live session (updated by heartbeat) ───
    session: {
      lastSeen: { type: Date },
      currentIp: { type: String },
      battery: { type: Number },
      networkType: { type: String },
      currentScreen: { type: String },
      onlineStatus: { type: Boolean, default: false },
      appVersion: { type: String },
      lastSync: { type: Date },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
        accuracy: { type: Number },
      },
    },

    appVersion: {
      type: String,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
    heartbeatAt: { type: Date },
    provisioningToken: {
      type: String, // Temporary token used during QR scan handshake
    },
  },
  { timestamps: true },
);

deviceSchema.index({ dealerId: 1, status: 1 });

module.exports = mongoose.model("Device", deviceSchema);
