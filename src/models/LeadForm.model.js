const mongoose = require("mongoose");

const leadFormSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    mobileBrand: {
      type: String,
      trim: true,
    },
    mobileModel: {
      type: String,
      trim: true,
    },
    // Optional KYC fields
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    panNumber: {
      type: String,
      trim: true,
    },
    // Track which app the lead came from
    source: {
      type: String,
      default: "VLockerReferralApp",
      trim: true,
    },
    status: {
      type: String,
      enum: ["new", "contacted", "converted", "rejected"],
      default: "new",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const LeadForm = mongoose.model("LeadForm", leadFormSchema);

module.exports = LeadForm;
