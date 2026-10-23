const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Loan = require("./src/models/CustomerLoan.model");
const connectDB = require("./src/config/database");
const {
  calculateOverdueDays,
  calculateLateFee,
} = require("./src/utils/overdueUtils");

async function checkLoan() {
  await connectDB();
  const loans = await Loan.find({ loanStatus: "APPROVED" }).sort({
    createdAt: -1,
  });

  if (loans.length === 0) {
    console.log("No approved loans found");
    process.exit(0);
  }

  console.log(`Found ${loans.length} approved loans.`);

  const now = new Date();

  for (const loan of loans) {
    console.log(`\n--- Loan ID: ${loan._id} ---`);
    console.log(`IMEI: ${loan.imeiNumber1}, Phone: ${loan.customerId}`);

    if (loan.installments && Array.isArray(loan.installments)) {
      loan.installments.forEach((inst) => {
        const days = calculateOverdueDays(inst.dueDate, now);
        const fee = calculateLateFee(days);
        console.log(
          `Inst ${inst.installmentNumber}: Due ${inst.dueDate.toISOString().split("T")[0]}, Status: ${inst.status}, Days Overdue: ${days}, Expected Late Fee: ${fee}, Current Late Fee: ${inst.lateFee}`,
        );
      });
    }
  }

  process.exit(0);
}

checkLoan();
