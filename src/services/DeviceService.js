const Loan = require("../models/CustomerLoan.model");
const Customer = require("../models/Customer.model");
const User = require("../models/UserModel");
const { sendNotificationCore } = require("../lib/notifications");

/**
 * Helper to find a loan by either MongoDB ID or IMEI.
 * @param {string} identifier - Loan ID or IMEI.
 */
const findLoan = async (identifier) => {
  let loan;
  if (require("mongoose").Types.ObjectId.isValid(identifier)) {
    loan = await Loan.findById(identifier).populate("customerId");
  }

  if (!loan) {
    loan = await Loan.findOne({
      $or: [{ imeiNumber1: identifier }, { imeiNumber2: identifier }],
    }).populate("customerId");
  }
  return loan;
};

/**
 * Core logic to lock a device.
 * @param {string} identifier - The ID or IMEI of the loan/device to lock.
 * @returns {Promise<{success: boolean, message: string}>}
 */
const lockDeviceCore = async (identifier) => {
  try {
    console.log(`[DeviceService] Locking device for identifier: ${identifier}`);

    const loan = await findLoan(identifier);
    if (!loan) {
      throw new Error("Loan not found");
    }

    const customer = loan.customerId;
    if (!customer) {
      throw new Error("Customer not found for this loan");
    }

    const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");
    let user = await User.findOne({ phone: customer.customerMobileNumber });
    if (!user) {
      user = await User.findOne({ phone: searchPhone });
    }

    if (user && user.pushNotificationToken) {
      try {
        await sendNotificationCore({
          userId: user._id,
          title: "Device Lock",
          body: "Your device is being locked due to overdue payment.",
          data: { type: "LOCK" },
          silent: true,
          highPriority: true,
        });
        console.log(
          `[DeviceService] FCM lock notification sent to User: ${user._id}`,
        );
      } catch (firebaseError) {
        console.error("[DeviceService] Firebase Send Error:", firebaseError);
      }
    } else {
      console.log("[DeviceService] User/Token not found for notification.");
    }

    loan.deviceUnlockStatus = "LOCKED";
    await loan.save();

    return { success: true, message: "Device locked successfully" };
  } catch (error) {
    console.error("[DeviceService] Error locking device:", error);
    throw error;
  }
};

/**
 * Core logic to unlock a device.
 * @param {string} identifier - The ID or IMEI of the loan/device to unlock.
 * @returns {Promise<{success: boolean, message: string}>}
 */
const unlockDeviceCore = async (identifier) => {
  try {
    console.log(
      `[DeviceService] Unlocking device for identifier: ${identifier}`,
    );

    const loan = await findLoan(identifier);
    if (!loan) {
      throw new Error("Loan not found");
    }

    const customer = loan.customerId;
    if (!customer) {
      throw new Error("Customer not found for this loan");
    }

    const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");
    console.log(
      `[DeviceService] Searching for User with phone: '${customer.customerMobileNumber}' or '${searchPhone}'`,
    );

    let user = await User.findOne({ phone: customer.customerMobileNumber });
    if (!user) {
      user = await User.findOne({ phone: searchPhone });
    }

    if (user) {
      console.log(
        `[DeviceService] Found User: ${user._id}, Has Token: ${!!user.pushNotificationToken}`,
      );
    } else {
      console.log("[DeviceService] User NOT found by phone.");
    }

    if (user && user.pushNotificationToken) {
      try {
        await sendNotificationCore({
          userId: user._id,
          title: "Device Unlocked",
          body: "Your device has been unlocked.",
          data: { type: "UNLOCK" },
          silent: true,
          highPriority: true,
        });
        console.log(
          `[DeviceService] FCM unlock notification sent to User: ${user._id}`,
        );
      } catch (firebaseError) {
        console.error("[DeviceService] Firebase Send Error:", firebaseError);
      }
    } else {
      console.log("[DeviceService] User/Token not found for notification.");
    }

    loan.deviceUnlockStatus = "UNLOCKED";
    loan.manualUnlockTimestamp = new Date();
    await loan.save();

    return { success: true, message: "Device unlocked successfully" };
  } catch (error) {
    console.error("[DeviceService] Error unlocking device:", error);
    throw error;
  }
};

module.exports = {
  lockDeviceCore,
  unlockDeviceCore,
};
