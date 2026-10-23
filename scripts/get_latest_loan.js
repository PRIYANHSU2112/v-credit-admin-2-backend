const mongoose = require("mongoose");
const Loan = require("../src/models/CustomerLoan.model");

// Extracted from .env
const MONGO_URI =
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

const getLoan = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const loans = await Loan.find().sort({ createdAt: -1 }).limit(1);
    if (loans.length > 0) {
      console.log("LATEST LOAN ID:", loans[0]._id.toString());
      console.log("CURRENT STATUS:", loans[0].deviceUnlockStatus);
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

getLoan();
