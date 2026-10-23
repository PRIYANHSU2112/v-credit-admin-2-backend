const mongoose = require("mongoose");

const keyTransferSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    keyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseKey" }],
    batchId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Reversed"],
      default: "Completed",
    },
    note: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("KeyTransfer", keyTransferSchema);
