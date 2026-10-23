const mongoose = require("mongoose");

const KEY_STATUSES = [
  "Generated",
  "Allocated",
  "Transferred",
  "Received",
  "Assigned",
  "Activated",
  "Running",
  "Expired",
  "Renewed",
  "Locked",
  "Revoked",
  "Returned",
];

// Statuses that still count as "available" (not yet consumed by an active device)
const AVAILABLE_STATUSES = ["Generated", "Allocated", "Transferred", "Received"];

const enterpriseKeySchema = new mongoose.Schema(
  {
    keyNumber: { type: String, required: true, unique: true, trim: true },
    keyType: { type: String, default: "standard", trim: true },
    batchId: { type: String, trim: true, index: true },
    currentOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    originalOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: KEY_STATUSES,
      default: "Generated",
      index: true,
    },
    activationDate: { type: Date },
    expiryDate: { type: Date },
    // Customer the key is reserved/assigned for (set at loan creation by the dealer)
    assignedToCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    assignedAt: { type: Date },
    activatedForCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    activatedForLoanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
    },
    // Device binding (set at mobile activation)
    imei: { type: String, trim: true },
    androidId: { type: String, trim: true },
    deviceId: { type: String, trim: true },
    fcmToken: { type: String },
    // Hierarchy snapshot at activation time (dealer → distributor → stockist)
    dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stockistId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDisabled: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    history: [
      {
        action: String,
        fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

enterpriseKeySchema.index({ currentOwnerId: 1, status: 1, isDeleted: 1 });

module.exports = mongoose.model("EnterpriseKey", enterpriseKeySchema);
module.exports.KEY_STATUSES = KEY_STATUSES;
module.exports.AVAILABLE_STATUSES = AVAILABLE_STATUSES;
