const mongoose = require("mongoose");

const keyInventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    totalKeys: { type: Number, default: 0, min: 0 },
    availableKeys: { type: Number, default: 0, min: 0 },
    transferredKeys: { type: Number, default: 0, min: 0 },
    receivedKeys: { type: Number, default: 0, min: 0 },
    usedKeys: { type: Number, default: 0, min: 0 },
    activatedKeys: { type: Number, default: 0, min: 0 },
    expiredKeys: { type: Number, default: 0, min: 0 },
    lockedKeys: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("KeyInventory", keyInventorySchema);
