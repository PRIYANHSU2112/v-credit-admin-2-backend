const mongoose = require("mongoose");
const Loan = require("../src/models/CustomerLoan.model");

// Hardcoded for speed - ensure this matches your .env
const MONGO_URI =
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

const forceLock = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const loans = await Loan.find().sort({ createdAt: -1 }).limit(1);
    if (loans.length > 0) {
      const loan = loans[0];
      console.log("Targeting Loan:", loan._id.toString());
      loan.deviceUnlockStatus = "LOCKED";
      await loan.save();
      console.log("SUCCESS: Loan status forced to LOCKED");
    } else {
      console.log("No loans found");
    }
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

forceLock();
