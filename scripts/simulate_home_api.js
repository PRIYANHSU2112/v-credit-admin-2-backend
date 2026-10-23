const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../src/models/UserModel");
const { homeInfo } = require("../src/controllers/Home.controller");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";
const JWT_SECRET = process.env.JWT_SECRET || "set-a-secure-jwt-secret";

async function simulateDashboard() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const PHONE = "6205872519";
    const user = await User.findOne({ phone: PHONE });

    if (!user) {
      console.log("User not found!");
      return;
    }
    console.log("User Found:", user._id);

    // Mock Req/Res
    const req = {
      userId: user._id,
      user: user, // in case middleware attaches it
    };
    const res = {
      status: function (code) {
        console.log("Response Status:", code);
        return this;
      },
      json: function (data) {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
        return this;
      },
    };

    console.log("Calling homeInfo...");
    await homeInfo(req, res);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

simulateDashboard();
