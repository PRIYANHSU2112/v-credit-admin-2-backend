require("dotenv").config({ path: ".env" }); // Load .env from current directory
const mongoose = require("mongoose");

// Import models
const CustomerLoan = require("../src/models/CustomerLoan.model");
const Device = require("../src/models/Device.model");
const Keys = require("../src/models/KeysModel");
const Customer = require("../src/models/Customer.model");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vlocker";

async function resetDatabase() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to:", MONGO_URI);

    console.log("--- STARTING RESET ---");

    // 1. Delete Customer Loans
    const resultLoans = await CustomerLoan.deleteMany({});
    console.log(`Deleted ${resultLoans.deletedCount} Customer Loans.`);

    // 2. Delete Devices
    const resultDevices = await Device.deleteMany({});
    console.log(`Deleted ${resultDevices.deletedCount} Devices.`);

    // 3. Delete Keys (IMEI/Requests)
    const resultKeys = await Keys.deleteMany({});
    console.log(`Deleted ${resultKeys.deletedCount} Keys.`);

    // 4. Delete Customers
    const resultCustomers = await Customer.deleteMany({});
    console.log(`Deleted ${resultCustomers.deletedCount} Customers.`);

    console.log("--- RESET COMPLETE ---");
  } catch (error) {
    console.error("Error resetting database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
    process.exit(0);
  }
}

resetDatabase();
