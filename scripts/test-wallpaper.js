// Quick test script to enable wallpaper feature
// Run this in your api-vlocker directory

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/vlocker", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Loan = require("./src/models/CustomerLoan.model");

async function enableWallpaper() {
  try {
    // Find loan by IMEI
    const loan = await Loan.findOne({ imeiNumber1: "867400022047199" });

    if (!loan) {
      console.log("Loan not found for IMEI: 867400022047199");
      return;
    }

    // Update wallpaper policy
    loan.devicePolicy.isWallpaperEnabled = true;
    loan.devicePolicy.wallpaperUrl =
      "https://brands.live/template/emi-due-soon-financial-reminder"; // EMI reminder wallpaper

    await loan.save();

    console.log("✅ Wallpaper policy updated successfully!");
    console.log("Policy:", loan.devicePolicy);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

enableWallpaper();
