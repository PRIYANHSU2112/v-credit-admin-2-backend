const mongoose = require("mongoose");
const User = require("../src/models/UserModel");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function getUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const users = await User.find({});
    console.log("Total Users:", users.length);
    users.forEach((u) =>
      console.log(`User: ${u.name}, Phone: ${u.phone}, ID: ${u._id}`),
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

getUser();
