const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function deleteAllCustomers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    // 1. Delete all Customers
    const customerResult = await Customer.deleteMany({});
    console.log(`Deleted ${customerResult.deletedCount} customer profiles.`);

    // 2. Delete all Users who are NOT admins (assuming role 'user' is for customers)
    const userResult = await User.deleteMany({ role: "user" });
    console.log(
      `Deleted ${userResult.deletedCount} user accounts (role: 'user').`
    );
  } catch (error) {
    console.error("Error deleting customers:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

deleteAllCustomers();
