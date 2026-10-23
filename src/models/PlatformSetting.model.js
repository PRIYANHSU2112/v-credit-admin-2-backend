const mongoose = require("mongoose");

const platformSettingSchema = new mongoose.Schema(
  {
    keyPrice: { type: Number, default: 350 },
    iphoneKeyPrice: { type: Number, default: 600 },
    stockistCommissionRate: { type: Number, default: 12 },
    distributorCommissionRate: { type: Number, default: 8 },
    dealerCommissionRate: { type: Number, default: 5 },
    autoLockOnOverdue: { type: Boolean, default: true },
    gracePeriodDays: { type: Number, default: 3 },
    smsGatewayActive: { type: Boolean, default: true },
    whatsappAlerts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSetting", platformSettingSchema);
