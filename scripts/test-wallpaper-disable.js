// Script to disable wallpaper feature
// Run this in your api-vlocker directory

const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/vlocker", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Loan = require("./src/models/CustomerLoan.model");

async function disableWallpaper() {
  try {
    // Find loan by IMEI
    const loan = await Loan.findOne({ imeiNumber1: "867400022047199" });

    if (!loan) {
      console.log("Loan not found for IMEI: 867400022047199");
      return;
    }

    // Disable wallpaper policy
    loan.devicePolicy.isWallpaperEnabled = false;
    loan.devicePolicy.wallpaperUrl = "";

    await loan.save();

    console.log("✅ Wallpaper disabled successfully!");
    console.log("Policy:", loan.devicePolicy);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

disableWallpaper();
