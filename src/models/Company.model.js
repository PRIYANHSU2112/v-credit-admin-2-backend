const mongoose = require("mongoose");

 
const companySupportSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: "V-Locker App",
    },
    logo: {
      type: String,
    },

    termsAndCondition: { type: String, trim: true, },
    privacyPolicy: { type: String, trim: true, },
    supportEmail: { type: String, trim: true, },
    aboutUs: { type: String, trim: true, },
    contactNumber: { type: String, trim: true, },
    helpAndSupport: { type: String, trim: true, },
    address: { type: String, trim: true, },
    favIcon: { type: String, trim: true, },
    loader: { type: String, trim: true },
    website: {
      type: String,
    },
    timings: {
      type: String,
    },

    whatsappNumber: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySupportSchema);
