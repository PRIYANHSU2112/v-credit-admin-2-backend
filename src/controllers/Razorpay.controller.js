const Razorpay = require("razorpay");
const crypto = require("crypto");
const Loan = require("../models/CustomerLoan.model");
const { unlockDeviceCore } = require("../services/DeviceService");
const { sendNotificationCore } = require("../lib/notifications");
const User = require("../models/UserModel");
const { calculateTotalInstallmentDue } = require("../utils/overdueUtils");

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn(
    "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Payment functionality will not work.",
  );
}

/**
 * Create a Razorpay Order for a Loan EMI.
 */
const createOrder = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay is not configured. Please add keys to environment variables.",
      });
    }
    const { loanId, installmentId, amount, payFull } = req.body;
    const loan = await Loan.findById(loanId);

    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }

    let totalDueAmount = 0;

    if (payFull) {
      // Early / pre-payment (foreclosure): pay off the ENTIRE remaining loan,
      // i.e. every installment that is not fully paid (including future ones).
      if (Array.isArray(loan.installments)) {
        loan.installments.forEach((inst) => {
          if (inst.status !== "PAID") {
            totalDueAmount += calculateTotalInstallmentDue(inst);
          }
        });
      }
      if (totalDueAmount <= 0) {
        totalDueAmount = Math.max(0, Number(loan.amountLeft || 0));
      }
    } else if (amount && !isNaN(amount) && Number(amount) > 0) {
      // Use amount override if provided (useful for syncing with app's display)
      totalDueAmount = Number(amount);
    } else {
      const now = new Date();
      if (installmentId) {
        // Pay a specific installment
        const inst = loan.installments.id(installmentId);
        if (!inst) {
          return res
            .status(404)
            .json({ success: false, message: "Installment not found" });
        }
        if (inst.status === "PAID") {
          return res
            .status(400)
            .json({ success: false, message: "Installment already paid" });
        }
        totalDueAmount = calculateTotalInstallmentDue(inst);
      } else {
        // Fallback: calculate total due (overdue + current)
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
      }
    }

    if (totalDueAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: installmentId
          ? "No pending amount for this installment"
          : "No pending installments found",
      });
    }

    const options = {
      amount: totalDueAmount * 100, // Amount in paise
      currency: "INR",
      receipt: `rp_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order,
      loanId,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    // Bubble up as much info as possible for debugging
    const errorDetails =
      error.error?.description ||
      error.description ||
      error.message ||
      "Unknown Razorpay error";
    res.status(500).json({
      success: false,
      message: `Razorpay Error: ${errorDetails}`,
      rawError: error,
      details: error.error || error,
    });
  }
};

/**
 * Verify Razorpay Payment and Unlock Device.
 */
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      loanId,
      installmentId,
      payFull,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

    // Payment Verified! Update DB
    const loan = await Loan.findById(loanId).populate("customerId");
    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found after payment" });
    }

    let paidAmountInThisTransaction = 0;

    if (payFull) {
      // Early full payment (foreclosure): clear every unpaid installment and
      // close the loan so the device stays permanently unlocked.
      loan.installments.forEach((inst) => {
        if (inst.status === "PAID") return;
        paidAmountInThisTransaction += calculateTotalInstallmentDue(inst);
        inst.paidAmount =
          (inst.amount || 0) + (inst.lateFee || 0) + (inst.bounceFee || 0);
        inst.lateFee = 0;
        inst.bounceFee = 0;
        inst.status = "PAID";
        inst.paidDate = new Date();
        inst.paymentMethod = "upi";
      });
      loan.loanStatus = "CLOSED";
    } else if (installmentId) {
      // Apply payment to a specific installment
      const inst = loan.installments.id(installmentId);
      if (inst) {
        paidAmountInThisTransaction = calculateTotalInstallmentDue(inst);
        inst.paidAmount =
          (inst.amount || 0) + (inst.lateFee || 0) + (inst.bounceFee || 0);
        inst.lateFee = 0;
        inst.bounceFee = 0;
        inst.status = "PAID";
        inst.paidDate = new Date();
        inst.paymentMethod = "upi";
      }
    } else {
      // Legacy / Fallback: Hierarchical adjustment for total due
      const now = new Date();
      let amountToApply = 0;
      loan.installments.forEach((inst) => {
        if (
          inst.status !== "PAID" &&
          (new Date(inst.dueDate) <= now ||
            inst.status === "OVERDUE" ||
            inst.status === "PARTIAL")
        ) {
          amountToApply += calculateTotalInstallmentDue(inst);
        }
      });

      paidAmountInThisTransaction = amountToApply;
      let currentPool = amountToApply;

      // Sort by dueDate to pay oldest first
      const sortedInstallments = [...loan.installments].sort(
        (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      );

      sortedInstallments.forEach((inst) => {
        if (inst.status === "PAID" || currentPool <= 0) return;

        // 1. Pay Late Fee
        const lateFeeToPay = Math.min(currentPool, inst.lateFee || 0);
        inst.lateFee = (inst.lateFee || 0) - lateFeeToPay;
        currentPool -= lateFeeToPay;

        // 2. Pay Bounce Fee
        const bounceFeeToPay = Math.min(currentPool, inst.bounceFee || 0);
        inst.bounceFee = (inst.bounceFee || 0) - bounceFeeToPay;
        currentPool -= bounceFeeToPay;

        // 3. Pay EMI Principal
        const principalDue = (inst.amount || 0) - (inst.paidAmount || 0);
        const principalToPay = Math.min(currentPool, principalDue);
        inst.paidAmount = (inst.paidAmount || 0) + principalToPay;
        currentPool -= principalToPay;

        // Check if fully paid
        if (calculateTotalInstallmentDue(inst) <= 0) {
          inst.status = "PAID";
          inst.paidDate = new Date();
          inst.paymentMethod = "upi";
        } else {
          inst.status = "PARTIAL";
        }
      });
    }

    loan.amountPaid = (loan.amountPaid || 0) + paidAmountInThisTransaction;
    loan.amountLeft = Math.max(
      0,
      (loan.amountLeft || 0) - paidAmountInThisTransaction,
    );

    // Auto-close loan if all installments are paid or amountLeft is 0
    const allInstallmentsPaid =
      loan.installments &&
      loan.installments.length > 0 &&
      loan.installments.every((inst) => inst.status === "PAID");

    if (allInstallmentsPaid || loan.amountLeft <= 0) {
      loan.loanStatus = "CLOSED";
      loan.deviceUnlockStatus = "UNLOCKED";
      if (loan.installments) {
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
        loan.devicePolicy.isResetAllowed = true;
        loan.devicePolicy.isUninstallAllowed = true;
        loan.devicePolicy.frpAccounts = [];
      }
    }

    await loan.save();

    // Trigger Unlock
    await unlockDeviceCore(loanId);

    // Send immediate Policy Update to unhide apps/reset wallpaper
    // This is because the device might take 10s to poll getHomeData
    if (loan.customerId) {
      const customer = loan.customerId;
      const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");
      const user = await User.findOne({
        $or: [{ phone: customer.customerMobileNumber }, { phone: searchPhone }],
      });

      if (user && user.pushNotificationToken) {
        // Build a CLEAN policy
        const cleanPolicy = {
          isResetAllowed: false,
          isUninstallAllowed: false,
          isDeveloperOptionsBlocked: false,
          isWallpaperEnabled: false,
          wallpaperUrl: "",
          isWhatsAppBlocked: false,
          isInstagramBlocked: false,
          isSnapchatBlocked: false,
          isYouTubeBlocked: false,
          isFacebookBlocked: false,
          isDialerBlocked: false,
          isMessagesBlocked: false,
          isPlayStoreBlocked: false,
          isChromeBlocked: false,
          isVoiceReminderEnabled: false,
        };

        await sendNotificationCore({
          userId: user._id,
          title: "Payment Received",
          body: "Your payment has been verified. Device is unlocking.",
          data: {
            type: "POLICY_UPDATE",
            policy: JSON.stringify(cleanPolicy),
          },
          silent: true,
          highPriority: true,
        });
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Payment verified and device unlocked" });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
};
