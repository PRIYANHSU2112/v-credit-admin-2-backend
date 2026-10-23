const mongoose = require("mongoose");

const mobileBrandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MobileBrand", mobileBrandSchema);
