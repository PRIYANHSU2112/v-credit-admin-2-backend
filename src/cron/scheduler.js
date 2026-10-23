const cron = require("node-cron");
const Loan = require("../models/CustomerLoan.model");
const {
  lockDeviceCore,
  unlockDeviceCore,
} = require("../services/DeviceService");
const {
  calculateOverdueDays,
  calculateLateFee,
  calculateTotalInstallmentDue,
  isLoanCleared,
  settleClearedLoan,
} = require("../utils/overdueUtils");

const runAutoLockScheduler = () => {
  // Run every hour. (Change to '0 0 * * *' for daily midnight)
  cron.schedule("0 * * * *", async () => {
    console.log("Running Auto Lock/Unlock Scheduler...");

    try {
      // Find all APPROVED loans
      const loans = await Loan.find({
        loanStatus: "APPROVED",
      });

      console.log(`Found ${loans.length} approved loans.`);

      for (const loan of loans) {
        try {
          const now = new Date();
          let maxOverdueDays = 0;
          let totalDuesPending = 0;
          let changed = false;

          if (loan.installments && Array.isArray(loan.installments)) {
            loan.installments.forEach((inst) => {
              // 1. Calculate overdue and apply fees
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

              // 2. Track total pending dues for auto-unlock logic
              if (inst.status !== "PAID") {
                const due = calculateTotalInstallmentDue(inst);
                if (due > 0) {
                  totalDuesPending += due;
                }
              }
            });
          }

          if (isLoanCleared(loan)) {
            console.log(
              `Loan ${loan._id} is fully paid. Closing loan and unlocking device...`,
            );
            const wasLocked = loan.deviceUnlockStatus === "LOCKED";
            settleClearedLoan(loan);
            await loan.save();
            if (wasLocked) {
              await unlockDeviceCore(loan._id);
            }
            continue;
          }

          if (changed) {
            await loan.save();
          }

          // 3. Locking Logic
          // Lock 1 day after the EMI becomes overdue (i.e. due date + 1 day).
          // overdueDaysToLock defaults to 1; use >= so a value of 1 locks as
          // soon as the loan is 1 day past due.
          const lockThreshold = loan.overdueDaysToLock || 1;
          if (maxOverdueDays >= lockThreshold) {
            // Trigger lock if overdue >= threshold
            if (loan.deviceUnlockStatus !== "LOCKED") {
              console.log(
                `Loan ${loan._id} is ${maxOverdueDays} days overdue. Threshold is ${lockThreshold}. Locking device...`,
              );
              await lockDeviceCore(loan._id);
            }
          } else if (totalDuesPending <= 0) {
            // Auto-unlock whenever ALL dues (principal + fees) are cleared
            if (loan.deviceUnlockStatus === "LOCKED") {
              console.log(
                `Loan ${loan._id} has zero dues. Unlocking device...`,
              );
              await unlockDeviceCore(loan._id);
            }
          }
        } catch (err) {
          console.error(`Error processing loan ${loan._id} in scheduler:`, err);
        }
      }
    } catch (error) {
      console.error("Error in Auto Lock Scheduler:", error);
    }
    console.log("Auto Lock/Unlock Scheduler finished.");
  });

  // Enterprise key expiry sweep — runs every day at 00:05.
  // Marks activated keys past their expiry as "Expired", flags the device,
  // records activation history and notifies the dealer.
  cron.schedule("5 0 * * *", async () => {
    try {
      const {
        checkAndExpireKeys,
      } = require("../services/mobile/activation.service");
      const result = await checkAndExpireKeys();
      if (result.expired > 0) {
        console.log(`Key expiry sweep: expired ${result.expired} key(s).`);
      }
    } catch (error) {
      console.error("Key expiry sweep error:", error.message);
    }
  });
};

module.exports = { runAutoLockScheduler };
