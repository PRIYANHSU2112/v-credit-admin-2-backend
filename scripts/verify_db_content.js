require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const CustomerLoan = require("../src/models/CustomerLoan.model");
const Customer = require("../src/models/Customer.model");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vlocker";

async function checkData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to:", MONGO_URI);

    // List all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(
      "Collections:",
      collections.map((c) => c.name),
    );

    // Check counts
    const loanCount = await CustomerLoan.countDocuments();
    const customerCount = await Customer.countDocuments();

    // Check specific collections based on model names
    // CustomerLoan model -> "Loan" -> collection "loans" (usually pluralized)
    const rawLoansCount = await mongoose.connection
      .collection("loans")
      .countDocuments();
    const rawCustomerLoansCount = await mongoose.connection
      .collection("customerloans")
      .countDocuments();

    console.log(`Model CustomerLoan count: ${loanCount}`);
    console.log(`Model Customer count: ${customerCount}`);
    console.log(`Raw 'loans' collection count: ${rawLoansCount}`);
    console.log(
      `Raw 'customerloans' collection count: ${rawCustomerLoansCount}`,
    );

    // Peek at data if exists
    if (loanCount > 0) {
      const loan = await CustomerLoan.findOne();
      console.log("Sample Loan:", JSON.stringify(loan, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkData();
