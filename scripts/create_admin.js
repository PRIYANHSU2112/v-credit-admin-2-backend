const mongoose = require("mongoose");
const User = require("../src/models/UserModel");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function createAdmin() {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const email = "adminlocker@gmail.com";
    const password = "123456";

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.log("Admin user already exists:", email);
      // Update password just in case
      const hashedPassword = await bcrypt.hash(password, 12);
      existingAdmin.password = hashedPassword;
      existingAdmin.role = "admin";
      await existingAdmin.save();
      console.log("Updated existing admin password to 123456");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      name: "Admin Locker",
      isProfileCompleted: true,
      isDisabled: false,
      phone: "0000000000",
    });

    console.log("Admin created successfully:");
    console.log("Email:", newAdmin.email);
    console.log("Password:", password);
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
