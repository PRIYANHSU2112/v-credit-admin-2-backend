const mongoose = require("mongoose");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function diagnose() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("DB Connected");

    const phone = "9000000001";
    const user = await User.findOne({ phone: phone });

    console.log(`\n1. DB Check for ${phone}:`);
    if (user) {
      console.log("   FOUND User:", user._id);
      console.log("   Phone in DB:", `'${user.phone}'`);
    } else {
      console.log("   NOT FOUND in DB via Mongoose.");
    }

    console.log("\n2. API Check (send-otp):");
    const response = await fetch("http://localhost:3000/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone, type: "login" }),
    });

    console.log("   Status:", response.status);
    const text = await response.text();
    console.log("   Body:", text);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

diagnose();
