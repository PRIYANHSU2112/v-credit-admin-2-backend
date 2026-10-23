const mongoose = require("mongoose");

const impersonationLogSchema = new mongoose.Schema(
  {
    originalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    impersonatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    ip: { type: String },
    userAgent: { type: String },
    reason: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ImpersonationLog", impersonationLogSchema);
