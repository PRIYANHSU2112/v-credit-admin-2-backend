const mongoose = require("mongoose");

// A device policy can be defined at three scopes. Resolution order (most specific wins):
//   device  → specific deviceId
//   dealer  → all devices under a dealer (ownerId = dealer userId)
//   global  → platform default (single doc with scope "global")
const devicePolicySchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["device", "dealer", "global"],
      required: true,
      index: true,
    },
    deviceId: { type: String, index: true }, // when scope = device
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // when scope = dealer

    // Individual policy toggles (true = allowed/enabled)
    deviceLockPolicy: {
      lockOnOverdue: { type: Boolean, default: true },
      gracePeriodDays: { type: Number, default: 3 },
    },
    camera: { type: Boolean, default: true },
    microphone: { type: Boolean, default: true },
    usb: { type: Boolean, default: true },
    factoryReset: { type: Boolean, default: false }, // allow user factory reset
    gps: { type: Boolean, default: true },
    wifi: { type: Boolean, default: true },
    bluetooth: { type: Boolean, default: true },
    calls: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },

    appBlacklist: [{ type: String }], // package names blocked
    appWhitelist: [{ type: String }], // package names always allowed
    allowedSettings: [{ type: String }],
    restrictedSettings: [{ type: String }],

    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DevicePolicy", devicePolicySchema);
