const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function listAllCustomers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const customers = await Customer.find({});
    console.log(`Found ${customers.length} customers:`);

    customers.forEach((c) => {
      console.log(
        `- Name: ${c.customerName}, Mobile: ${c.customerMobileNumber}, Verified: ${c.isVerified}, CreatedBy: ${c.createdBy}`
      );
    });

    const admins = await User.find({ role: "admin" });
    console.log(`\nAdmins found: ${admins.length}`);
    admins.forEach((a) => {
      console.log(`- Admin: ${a.email}, ID: ${a._id}`);
    });
  } catch (error) {
    console.error("Error listing customers:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

listAllCustomers();
