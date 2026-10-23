const mongoose = require("mongoose");

const COMMAND_TYPES = [
  "LOCK_DEVICE",
  "UNLOCK_DEVICE",
  "REBOOT",
  "FACTORY_RESET",
  "ENABLE_CAMERA",
  "DISABLE_CAMERA",
  "ENABLE_MIC",
  "DISABLE_MIC",
  "ENABLE_GPS",
  "DISABLE_GPS",
  "ENABLE_WIFI",
  "DISABLE_WIFI",
  "ENABLE_CALLS",
  "DISABLE_CALLS",
  "ENABLE_SMS",
  "DISABLE_SMS",
  "ENABLE_USB",
  "DISABLE_USB",
  "INSTALL_APP",
  "UNINSTALL_APP",
  "SYNC_POLICY",
  "SHOW_MESSAGE",
];

const COMMAND_STATUSES = ["PENDING", "SENT", "SUCCESS", "FAILED", "ERROR", "EXPIRED"];

const remoteCommandSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    type: { type: String, enum: COMMAND_TYPES, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: COMMAND_STATUSES,
      default: "PENDING",
      index: true,
    },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    issuedByRole: { type: String },
    // Idempotency / replay protection — client acks with this id
    commandRef: { type: String, unique: true, index: true },
    result: { type: mongoose.Schema.Types.Mixed },
    resultMessage: { type: String },
    sentAt: { type: Date },
    executedAt: { type: Date },
    executionTimeMs: { type: Number },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

remoteCommandSchema.index({ deviceId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model("RemoteCommand", remoteCommandSchema);
module.exports.COMMAND_TYPES = COMMAND_TYPES;
module.exports.COMMAND_STATUSES = COMMAND_STATUSES;
