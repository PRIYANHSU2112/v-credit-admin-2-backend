const mongoose = require("mongoose");
const Loan = require("../src/models/CustomerLoan.model");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function deleteAllLoans() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const result = await Loan.deleteMany({});
    console.log(`Deleted ${result.deletedCount} loans (ALL loans).`);
  } catch (error) {
    console.error("Error deleting all loans:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

deleteAllLoans();
