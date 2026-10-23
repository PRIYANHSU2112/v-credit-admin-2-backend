const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const Loan = require("../src/models/CustomerLoan.model");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";
const TEST_PHONE = "9000000001";

async function addSecondLoan() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    // 1. Find Existing User
    const user = await User.findOne({ phone: TEST_PHONE });
    if (!user) {
      console.error("User not found! Run setup_demo_data.js first.");
      return;
    }
    console.log(`Found User: ${user._id}`);

    // 2. Create NEW Customer (User requested new customer)
    const customer = await Customer.create({
      customerName: "Demo User 2 (Second Loan)",
      customerMobileNumber: TEST_PHONE,
      address: "Test Address 2",
      isVerified: true,
      createdBy: user._id,
    });
    console.log(`Created New Customer: ${customer._id}`);

    // 3. Create NEW Loan with UNIQUE IMEI
    const loan = await Loan.create({
      customerId: customer._id,
      loanAmount: 25000,
      loanStatus: "APPROVED",
      deviceUnlockStatus: "UNLOCKED",
      numberOfEMIs: 6,
      emiAmount: 4200,
      imeiNumber1: "DEMO_IMEI_456", // DIFFERENT IMEI
      mobileBrand: "Vivo",
      mobileModel: "V29",
      createdBy: user._id,
    });
    console.log(`Created New Loan: ${loan._id}`);

    console.log("\n================================================");
    console.log("             NEW LOAN CREATED");
    console.log("================================================");
    console.log("USE THIS NEW LOAN ID in Postman:");
    console.log(`   ${loan._id.toString()}`);
    console.log("================================================\n");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

addSecondLoan();
