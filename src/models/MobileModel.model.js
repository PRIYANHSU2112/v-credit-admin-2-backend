const mongoose = require("mongoose");

const mobileModelSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      trim: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MobileBrand",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MobileModel", mobileModelSchema);
