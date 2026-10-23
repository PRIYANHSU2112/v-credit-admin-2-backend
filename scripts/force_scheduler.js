const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

// Register all models
require("./src/models/UserModel");
require("./src/models/Customer.model");
const Loan = require("./src/models/CustomerLoan.model");
const { lockDeviceCore } = require("./src/services/DeviceService");

const connectDB = require("./src/config/database");
const {
  calculateOverdueDays,
  calculateLateFee,
} = require("./src/utils/overdueUtils");

async function forceUpdate() {
  await connectDB();
  const loans = await Loan.find({ loanStatus: "APPROVED" });
  console.log(`Processing ${loans.length} loans...`);

  const now = new Date();

  for (const loan of loans) {
    let changed = false;
    let maxOverdueDays = 0;

    if (loan.installments && Array.isArray(loan.installments)) {
      loan.installments.forEach((inst) => {
        if (inst.status !== "PAID" && new Date(inst.dueDate) < now) {
          const overdueDays = calculateOverdueDays(inst.dueDate, now);
          maxOverdueDays = Math.max(maxOverdueDays, overdueDays);

          const currentLateFee = calculateLateFee(overdueDays);
          if (inst.lateFee !== currentLateFee) {
            inst.lateFee = currentLateFee;
            changed = true;
          }

          if (inst.status === "PENDING") {
            inst.status = "OVERDUE";
            changed = true;
          }
        }
      });
    }

    if (changed) {
      await loan.save();
      console.log(
        `Updated Loan ${loan._id}: Max Overdue Days: ${maxOverdueDays}, Late Fees Applied.`,
      );
    }

    // LOCKING logic
    if (maxOverdueDays > (loan.overdueDaysToLock || 3)) {
      if (loan.deviceUnlockStatus !== "LOCKED") {
        console.log(
          `Locking Loan ${loan._id} (Overdue ${maxOverdueDays} days)...`,
        );
        await lockDeviceCore(loan._id);
      } else {
        console.log(`Loan ${loan._id} already LOCKED in DB.`);
      }
    }
  }

  process.exit(0);
}

forceUpdate();
