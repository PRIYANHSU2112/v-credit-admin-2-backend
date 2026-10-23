const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const User = require("../src/models/UserModel");
const Loan = require("../src/models/CustomerLoan.model");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function createVerifiedCustomer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const TEST_PHONE = "9000000001"; // Test number
    const ADMIN_ID = new mongoose.Types.ObjectId("696a10b75deeb3de6ed162ea"); // Real Admin ID from list_all_customers output

    // Cleanup first
    await Customer.deleteMany({ customerMobileNumber: TEST_PHONE });
    await User.deleteMany({ phone: TEST_PHONE });
    console.log("Cleaned up old test data for", TEST_PHONE);

    // 1. Create Customer
    const customer = await Customer.create({
      customerName: "Test Customer 1",
      customerMobileNumber: TEST_PHONE,
      address: "123 Test Street",
      isVerified: true,
      createdBy: ADMIN_ID,
    });
    console.log("Created Customer:", customer._id);

    // 2. Create User (for Login)
    const user = await User.create({
      phone: TEST_PHONE,
      role: "user",
      name: "Test Customer 1",
      isProfileCompleted: true,
    });
    console.log("Created User Login Account:", user._id);

    // 3. Create Active Loan (for Dashboard Data)
    const loan = await Loan.create({
      customerId: customer._id,
      loanAmount: 20000,
      interestRate: 10,
      numberOfEMIs: 6,
      emiAmount: 3500,
      loanStatus: "APPROVED",
      deviceUnlockStatus: "LOCKED",
      imeiNumber1: "TEST_IMEI_" + Math.floor(Math.random() * 1000000),
      imeiNumber2: "TEST_IMEI_" + Math.floor(Math.random() * 1000000),
      createdBy: ADMIN_ID,
      nextDueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days from now
      installments: [
        {
          dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          amount: 3500,
          status: "PENDING",
        },
        {
          dueDate: new Date(new Date().setDate(new Date().getDate() + 60)),
          amount: 3500,
          status: "PENDING",
        },
      ],
    });
    console.log("Created Active Loan:", loan._id);

    console.log("\n---------------------------------------------------");
    console.log("SUCCESS! Test User Ready.");
    console.log("Mobile Number: " + TEST_PHONE);
    console.log("OTP: 1234 (Default)");
    console.log("---------------------------------------------------");
  } catch (error) {
    console.error("Error creating test customer:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

createVerifiedCustomer();
