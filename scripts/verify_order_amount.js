const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

require("./src/models/UserModel");
require("./src/models/Customer.model");
const Loan = require("./src/models/CustomerLoan.model");
const connectDB = require("./src/config/database");
const { calculateTotalInstallmentDue } = require("./src/utils/overdueUtils");

async function verifyOrderAmount(loanId) {
  await connectDB();
  const loan = await Loan.findById(loanId);
  if (!loan) {
    console.log("Loan not found");
    process.exit(0);
  }

  let totalDueAmount = 0;
  const now = new Date();

  if (loan.installments && Array.isArray(loan.installments)) {
    loan.installments.forEach((inst) => {
      if (
        inst.status !== "PAID" &&
        (new Date(inst.dueDate) <= now ||
          inst.status === "OVERDUE" ||
          inst.status === "PARTIAL")
      ) {
        totalDueAmount += calculateTotalInstallmentDue(inst);
      }
    });
  }

  console.log("Loan ID:", loan._id);
  console.log("Calculated Order Amount:", totalDueAmount);
  console.log("Expected Amount (based on user report): 7699");

  process.exit(0);
}

const targetLoanId = "6977d0525bea312fd21f4acc";
verifyOrderAmount(targetLoanId);
