const mongoose = require("mongoose");
const User = require("../src/models/UserModel");
const Customer = require("../src/models/Customer.model");
const Loan = require("../src/models/CustomerLoan.model");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function createTestData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const timestamp = Date.now();
    const testPhone = `999${timestamp.toString().slice(-7)}`;
    const dummyToken = "f5S_2s...Invalid_Token_For_Testing...7d9";

    // 1. Create User (for Login/FCM)
    const user = await User.create({
      phone: testPhone,
      pushNotificationToken: dummyToken,
      role: "user",
    });
    console.log(`Created User: ${user._id} (Phone: ${testPhone})`);

    // 2. Create Customer (associated with Loan)
    // Note: Customer usually created by Admin/Shop.
    // We'll just create a standalone one.
    const customer = await Customer.create({
      customerName: "Test Auto Customer",
      customerMobileNumber: testPhone,
      isVerified: true,
    });
    console.log(`Created Customer: ${customer._id}`);

    // 3. Create Loan
    const loan = await Loan.create({
      customerId: customer._id,
      loanAmount: 10000,
      loanStatus: "APPROVED",
      deviceUnlockStatus: "UNLOCKED",
      numberOfEMIs: 12,
      emiAmount: 1000,
      imeiNumber1: `IMEI${timestamp}`,
    });
    console.log(`Created Loan: ${loan._id}`);

    console.log("\n------------------------------------------------");
    console.log("PLEASE USE THIS LOAN ID FOR TESTING:");
    console.log(loan._id.toString());
    console.log("------------------------------------------------\n");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

createTestData();
