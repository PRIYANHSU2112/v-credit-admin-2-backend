const mongoose = require("mongoose");
const Customer = require("../src/models/Customer.model");
const Loan = require("../src/models/CustomerLoan.model");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://databasesatyakabir:2rAmj9UE2xcsBoAq@cluster0.diksb.mongodb.net/v-locker";

async function checkLoanDetails() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    // List last 5 loans
    const loans = await Loan.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customerId");
    console.log(`Found ${loans.length} Recent Loans:`);
    loans.forEach((loan, index) => {
      console.log(`\nLoan #${index + 1}:`);
      console.log("- ID:", loan._id);
      console.log(
        "- Customer:",
        loan.customerId ? loan.customerId.customerName : "N/A"
      );
      console.log("- Brand:", loan.mobileBrand);
      console.log("- Model:", loan.mobileModel);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

checkLoanDetails();
