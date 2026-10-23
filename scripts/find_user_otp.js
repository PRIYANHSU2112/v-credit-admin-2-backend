require("dotenv").config({ path: "./.env" });
const mongoose = require("mongoose");
const User = require("./src/models/UserModel");

const findUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
    const users = await User.find({ phone: /2519$/ }).select(
      "+phoneOtp.codeHash",
    );
    console.log(`Found ${users.length} users.`);
    // Use for...of loop to handle async properly
    for (const u of users) {
      console.log(`User: ${u.phone}, Role: ${u.role}, ID: ${u._id}`);
      console.log("Full PhoneOTP:", JSON.stringify(u.phoneOtp, null, 2));

      // Also check Customer collection
      try {
        const Customer = require("./src/models/Customer.model");
        const cust = await Customer.findOne({
          customerMobileNumber: new RegExp(u.phone),
        });
        console.log("Customer Record Found:", !!cust);
        if (cust) {
          console.log("Customer ID:", cust._id);
          const Loan = require("./src/models/CustomerLoan.model");
          const loan = await Loan.findOne({ customerId: cust._id });
          console.log("Loan Record Found:", !!loan);
          if (loan) console.log("Loan Status:", loan.loanStatus);
        }
      } catch (e) {
        console.log("Customer check error:", e.message);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
};

findUser();
