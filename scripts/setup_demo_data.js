const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const Loan = require("../src/models/CustomerLoan.model");
const User = require("../src/models/UserModel"); // Corrected filename

const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";
const TEST_PHONE = "9000000001";

async function setupDemo() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    // 0. Clean User too
    await User.deleteMany({ phone: TEST_PHONE });
    // 1. Check if Customer exists, delete if so to be fresh
    await Customer.deleteMany({ customerMobileNumber: TEST_PHONE });
    await Loan.deleteMany({ imeiNumber1: "DEMO_IMEI_123" });

    // 1. Create User (Critical for Login)
    const user = await User.create({
      phone: TEST_PHONE,
      pushNotificationToken: "TEMP_TOKEN_WAITING_FOR_LOGIN",
      role: "user",
      isProfileCompleted: true,
    });
    console.log(`Created User: ${user._id} (Phone: ${TEST_PHONE})`);

    // 2. Create Customer
    const customer = await Customer.create({
      customerName: "Demo User",
      customerMobileNumber: TEST_PHONE,
      address: "Test Address",
      isVerified: true,
      createdBy: user._id, // LINK TO USER
    });
    console.log(`Created Customer: ${customer._id} (Phone: ${TEST_PHONE})`);

    // 3. Create Loan
    const loan = await Loan.create({
      customerId: customer._id,
      loanAmount: 50000,
      loanStatus: "APPROVED",
      deviceUnlockStatus: "UNLOCKED",
      numberOfEMIs: 12,
      emiAmount: 4500,
      imeiNumber1: "DEMO_IMEI_123",
      mobileBrand: "Samsung",
      mobileModel: "S24 Ultra",
      createdBy: user._id, // LINK TO USER
    });
    console.log(`Created Loan: ${loan._id}`);

    console.log("\n================================================");
    console.log("             SETUP COMPLETE");
    console.log("================================================");
    console.log("1. LOGIN to App with:");
    console.log(`   Phone: ${TEST_PHONE}`);
    console.log("   OTP:   1234");
    console.log("------------------------------------------------");
    console.log("2. USE LOAN ID in Postman:");
    console.log(`   ${loan._id.toString()}`);
    console.log("================================================\n");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

setupDemo();
