require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const CustomerLoan = require("../src/models/CustomerLoan.model");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vlocker";

async function unlockAllDevices() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to:", MONGO_URI);

    console.log("--- UNLOCKING ALL DEVICES ---");

    const result = await CustomerLoan.updateMany(
      {},
      {
        $set: {
          deviceUnlockStatus: "UNLOCKED",
          // Also resetting policy restrictions just in case
          "devicePolicy.isResetAllowed": true,
          "devicePolicy.isUninstallAllowed": true,
          "devicePolicy.isDeveloperOptionsBlocked": false,
          "devicePolicy.isWhatsAppBlocked": false,
          "devicePolicy.isInstagramBlocked": false,
          "devicePolicy.isSnapchatBlocked": false,
          "devicePolicy.isYouTubeBlocked": false,
          "devicePolicy.isFacebookBlocked": false,
          "devicePolicy.isDialerBlocked": false,
          "devicePolicy.isMessagesBlocked": false,
          "devicePolicy.isPlayStoreBlocked": false,
          "devicePolicy.isChromeBlocked": false,
        },
      },
    );

    console.log(`Updated ${result.modifiedCount} loans to UNLOCKED status.`);

    console.log("--- UNLOCK COMPLETE ---");
  } catch (error) {
    console.error("Error unlocking devices:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
    process.exit(0);
  }
}

unlockAllDevices();
