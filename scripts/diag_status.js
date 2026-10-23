const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

require("./src/models/UserModel");
require("./src/models/Customer.model");
const Loan = require("./src/models/CustomerLoan.model");
const connectDB = require("./src/config/database");
const { calculateTotalInstallmentDue } = require("./src/utils/overdueUtils");

async function checkStatus(imei) {
  await connectDB();

  const loan = await Loan.findOne({
    $or: [{ imeiNumber1: imei }, { imeiNumber2: imei }],
  });

  if (!loan) {
    console.log("No loan found for IMEI:", imei);
    process.exit(0);
  }

  const now = new Date();
  let totalDueAmount = 0;
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
  console.log("Total Due (Calculated):", totalDueAmount);
  console.log("Device Unlock Status (DB):", loan.deviceUnlockStatus);

  // Replicating getDeviceStatusByImei logic
  const GRACE_PERIOD_DAYS = 2;
  let effectiveStatus = "UNLOCKED";
  let lockReason = null;
  let daysOverdue = 0;

  const lastOverdueDueDate = loan.installments.reduce((maxDate, inst) => {
    if (inst.status === "PENDING" || inst.status === "OVERDUE") {
      if (new Date(inst.dueDate) <= now) {
        const d = new Date(inst.dueDate);
        return d > maxDate ? d : maxDate;
      }
    }
    return maxDate;
  }, new Date(0));

  if (lastOverdueDueDate.getTime() > 0) {
    const timeDiff = now.getTime() - lastOverdueDueDate.getTime();
    daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  }

  const isManuallyUnlocked =
    loan.deviceUnlockStatus === "UNLOCKED" &&
    new Date(loan.updatedAt) > lastOverdueDueDate;
  const gracePeriodExpired = daysOverdue >= GRACE_PERIOD_DAYS;

  if (totalDueAmount > 0) {
    if (isManuallyUnlocked) {
      effectiveStatus = "UNLOCKED";
      lockReason = "MANUAL_UNLOCK_OVERRIDE";
    } else if (gracePeriodExpired) {
      effectiveStatus = "LOCKED";
      lockReason = "AUTO_LOCK_OVERDUE";
    } else {
      effectiveStatus = "UNLOCKED";
      lockReason = "GRACE_PERIOD_ACTIVE";
    }
  } else if (loan.deviceUnlockStatus === "LOCKED") {
    effectiveStatus = "LOCKED";
    lockReason = "MANUAL_LOCK";
  }

  console.log("Effective Status (API):", effectiveStatus);
  console.log("Lock Reason:", lockReason);
  console.log("Days Overdue:", daysOverdue);

  process.exit(0);
}

const targetImei = process.argv[2] || "867400022047199_OLD_1771103907517";
checkStatus(targetImei);
