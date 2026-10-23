require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const CustomerLoan = require("../src/models/CustomerLoan.model");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vlocker";

async function inspectLoans() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to:", MONGO_URI);

    const loans = await CustomerLoan.find({});
    console.log(`Found ${loans.length} loans.`);

    loans.forEach((loan) => {
      console.log(
        `Loan ID: ${loan._id}, Status: ${loan.loanStatus}, Device Lock: ${loan.deviceUnlockStatus}, Policy:`,
        loan.devicePolicy,
      );
    });

    // Unlock them if any found
    if (loans.length > 0) {
      console.log("Unlocking all found loans...");
      const res = await CustomerLoan.updateMany(
        {},
        { $set: { deviceUnlockStatus: "UNLOCKED" } },
      );
      console.log(`Unlocked ${res.modifiedCount} loans.`);
    }
  } catch (error) {
    console.error("Error inspecting loans:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectLoans();
