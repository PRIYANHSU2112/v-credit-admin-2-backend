require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const EnterpriseKey = require("../src/models/EnterpriseKey.model");
const KeyTransfer = require("../src/models/KeyTransfer.model");
const KeyInventory = require("../src/models/KeyInventory.model");
const Keys = require("../src/models/KeysModel");
const ActivationHistory = require("../src/models/ActivationHistory.model");
const User = require("../src/models/UserModel");
const Device = require("../src/models/Device.model");

const MONGO_URI = process.env.MONGO_URI;

async function resetAllKeys() {
  if (!MONGO_URI) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.\n--- RESET ALL KEYS (fresh start) ---\n");

    const enterpriseKeys = await EnterpriseKey.deleteMany({});
    console.log(`EnterpriseKey deleted: ${enterpriseKeys.deletedCount}`);

    const transfers = await KeyTransfer.deleteMany({});
    console.log(`KeyTransfer deleted: ${transfers.deletedCount}`);

    const inventories = await KeyInventory.deleteMany({});
    console.log(`KeyInventory deleted: ${inventories.deletedCount}`);

    const keyRequests = await Keys.deleteMany({});
    console.log(`Key requests (legacy) deleted: ${keyRequests.deletedCount}`);

    const activationHistory = await ActivationHistory.deleteMany({});
    console.log(`ActivationHistory deleted: ${activationHistory.deletedCount}`);

    const users = await User.updateMany({}, { $set: { keys: 0 } });
    console.log(`User.keys set to 0: ${users.modifiedCount} users`);

    const devices = await Device.updateMany({}, { $unset: { keyId: 1 } });
    console.log(`Device keyId cleared: ${devices.modifiedCount} devices`);

    console.log("\n--- DONE: All keys reset to 0 / wiped ---");
    console.log("Super admin can generate fresh keys from Key Management.");
  } catch (error) {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

resetAllKeys();
