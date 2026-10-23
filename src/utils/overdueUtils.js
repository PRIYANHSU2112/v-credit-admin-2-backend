/**
 * Overdue Calculation Utilities
 */

/**
 * Calculate late fee based on overdue days
 * Slabs:
 * 1-3 days: ₹400
 * 4-7 days: ₹600
 * 8-15 days: ₹800
 * >15 days: ₹1000
 *
 * @param {number} overdueDays
 * @returns {number} lateFee
 */
const calculateLateFee = (overdueDays) => {
  if (overdueDays <= 0) return 0;
  if (overdueDays <= 3) return 400;
  if (overdueDays <= 7) return 600;
  if (overdueDays <= 15) return 800;
  return 1000;
};

/**
 * Calculate the total balance due for a single installment
 *
 * @param {Object} installment
 * @returns {number} totalDue
 */
const calculateTotalInstallmentDue = (installment) => {
  const principal = installment.amount || 0;
  const lateFee = installment.lateFee || 0;
  const bounceFee = installment.bounceFee || 0;
  const paid = installment.paidAmount || 0;

  return principal + lateFee + bounceFee - paid;
};

/**
 * Calculate overdue days between a due date and another date (usually now)
 *
 * @param {Date} dueDate
 * @param {Date} referenceDate
 * @returns {number} overdueDays
 */
const calculateOverdueDays = (dueDate, referenceDate = new Date()) => {
  const due = new Date(dueDate);
  const ref = new Date(referenceDate);

  if (ref <= due) return 0;

  const diffTime = Math.abs(ref - due);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

const isLoanCleared = (loan) => {
  if (!loan) return false;
  if (loan.loanStatus === "CLOSED") return true;
  const installments = loan.installments || [];
  if (
    installments.length > 0 &&
    installments.every((inst) => inst.status === "PAID")
  ) {
    return true;
  }
  return (loan.amountLeft || 0) <= 0 && (loan.amountPaid || 0) > 0;
};

const settleClearedLoan = (loan) => {
  if (!isLoanCleared(loan)) return false;

  loan.loanStatus = "CLOSED";
  loan.deviceUnlockStatus = "UNLOCKED";
  loan.amountLeft = 0;
  if (Array.isArray(loan.installments)) {
    loan.installments.forEach((inst) => {
      if (inst.status !== "PAID") {
        inst.status = "PAID";
        inst.lateFee = 0;
        inst.bounceFee = 0;
        inst.paidAmount = Math.max(inst.paidAmount || 0, inst.amount || 0);
        inst.paidDate = inst.paidDate || new Date();
      }
    });
    loan.installmentsPaid = loan.installments.length;
  }
  if (loan.devicePolicy) {
    loan.devicePolicy.isVoiceReminderEnabled = false;
    loan.devicePolicy.isWallpaperEnabled = false;
    loan.devicePolicy.wallpaperUrl = "";
    loan.devicePolicy.isWhatsAppBlocked = false;
    loan.devicePolicy.isInstagramBlocked = false;
    loan.devicePolicy.isSnapchatBlocked = false;
    loan.devicePolicy.isYouTubeBlocked = false;
    loan.devicePolicy.isFacebookBlocked = false;
    loan.devicePolicy.isDialerBlocked = false;
    loan.devicePolicy.isMessagesBlocked = false;
    loan.devicePolicy.isPlayStoreBlocked = false;
    loan.devicePolicy.isChromeBlocked = false;
    loan.devicePolicy.isUninstallAllowed = false;
  }
  return true;
};

module.exports = {
  calculateLateFee,
  calculateTotalInstallmentDue,
  calculateOverdueDays,
  isLoanCleared,
  settleClearedLoan,
};
