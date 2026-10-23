const mongoose = require("mongoose");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";
const TEST_PHONE = "9000000001";

async function checkToken() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const user = await User.findOne({ phone: TEST_PHONE });
    if (!user) {
      console.log("User not found!");
    } else {
      console.log(`User ID: ${user._id}`);
      console.log(`FCM Token: ${user.pushNotificationToken}`);

      if (user.pushNotificationToken === "TEMP_TOKEN_WAITING_FOR_LOGIN") {
        console.log("\n[DIAGNOSIS]: Token is still the PLACEHOLDER.");
        console.log("-> The App failed to update the token upon Login.");
      } else if (user.pushNotificationToken.length < 50) {
        console.log("\n[DIAGNOSIS]: Token looks suspicious (too short).");
      } else {
        console.log("\n[DIAGNOSIS]: Token looks like a valid string format.");
        console.log(
          "-> If it fails, it might be from a different Firebase project or expired."
        );
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

checkToken();
