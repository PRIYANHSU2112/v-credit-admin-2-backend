const mongoose = require("mongoose");
const NotificationModel = require("../src/models/Notification.model");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function createNotifications() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const users = [
      "696b1907078672f288ee455f", // Pradeep
      "696a7cf6a6633600e475ddc5", // Prince2
      "696a510b6921cf16b5c8723b", // Test Customer 1
    ];

    for (const userId of users) {
      await NotificationModel.create({
        userId: userId,
        title: "Welcome to V-Locker",
        body: "This is a test notification to verify the system.",
        data: { type: "test" },
        readStatus: false,
        createdAt: new Date(),
      });
      console.log(`Created notification for user ${userId}`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createNotifications();
