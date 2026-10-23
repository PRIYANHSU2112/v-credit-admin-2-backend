const mongoose = require("mongoose");

// Stores hashed refresh tokens for mobile sessions so they can be rotated and revoked.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, index: true },
    deviceId: { type: String, index: true },
    userAgent: { type: String },
    ip: { type: String },
    revoked: { type: Boolean, default: false },
    replacedBy: { type: String }, // tokenHash of the rotated successor
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL cleanup once expired
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
