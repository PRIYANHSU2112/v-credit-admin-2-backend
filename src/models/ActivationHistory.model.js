const mongoose = require("mongoose");

// Immutable log of every key lifecycle event tied to a device/customer.
const activationHistorySchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        "ASSIGNED",
        "ACTIVATED",
        "EXPIRED",
        "RENEWED",
        "REVOKED",
        "LOCKED",
        "UNLOCKED",
      ],
      required: true,
      index: true,
    },
    keyId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseKey", index: true },
    keyNumber: { type: String },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan" },
    deviceId: { type: String, index: true },
    imei: { type: String },
    androidId: { type: String },
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stockistId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ActivationHistory", activationHistorySchema);
