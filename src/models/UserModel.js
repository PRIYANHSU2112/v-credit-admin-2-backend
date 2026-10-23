const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple users without phone
    },
    phoneOtp: {
      codeHash: {
        type: String,
        select: false,
      },
      expiresAt: {
        type: Date,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      lastSentAt: {
        type: Date,
      },
    },
    resetToken: {
      token: String,
      expiresAt: Date,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      sparse: true,
      default: null,
      lowercase: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    profileUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    enterpriseRole: {
      type: String,
      enum: ["super_admin", "stockist", "distributor", "dealer", null],
      default: null,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    territory: { type: String, trim: true },
    city: { type: String, trim: true },
    gst: { type: String, trim: true },
    entityCode: { type: String, trim: true, sparse: true },
    enterpriseStatus: {
      type: String,
      enum: ["Active", "Suspended", "Pending", "Monitoring", "Inactive"],
      default: "Active",
    },
    keys: {
      type: Number,
      default: 0,
    },
    password: {
      type: String,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      default: null,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    pushNotificationToken: { type: String },
  },
  { timestamps: true },
);

userSchema.virtual("BusinessProfile", {
  ref: "BusinessProfile",
  localField: "_id",
  foreignField: "userId",
});
userSchema.set("toObject", { virtuals: true });
userSchema.set("toJSON", { virtuals: true });

const User = mongoose.model("User", userSchema);

module.exports = User;
