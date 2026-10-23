const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function checkAndFixUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const PHONE = "9000000001";

    const customer = await Customer.findOne({ customerMobileNumber: PHONE });
    console.log(`Customer Found: ${customer ? "YES" : "NO"}`);
    if (customer) console.log(`- Verified: ${customer.isVerified}`);

    const user = await User.findOne({ phone: PHONE });
    console.log(`User Found (Login Account): ${user ? "YES" : "NO"}`);

    if (customer && customer.isVerified && !user) {
      console.log("FIXING: Creating missing User account...");
      await User.create({
        phone: PHONE,
        role: "user",
        name: customer.customerName,
        isProfileCompleted: true,
      });
      console.log("SUCCESS: User account created. Login should work now.");
    } else if (!customer) {
      console.log(
        "ERROR: Customer profile does not exist. Please create customer first."
      );
    } else if (user) {
      console.log(
        "INFO: User account already exists. Login should be working."
      );
      // Reset OTP fields just in case
      user.phoneOtp = undefined;
      await user.save();
      console.log("- Reset OTP fields to ensure clean state.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

checkAndFixUser();
