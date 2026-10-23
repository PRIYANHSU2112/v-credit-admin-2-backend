const mongoose = require("mongoose");
const Device = require("../models/Device.model");
const Loan = require("../models/CustomerLoan.model");
const Customer = require("../models/Customer.model");

const admin = require("../config/firebaseAdmin");

// Helper to send FCM Command
const sendFCMCommand = async (deviceId, type, extraData = {}) => {
  try {
    const device = await Device.findOne({ deviceId });
    if (!device || !device.fcmToken) {
      console.log(`[FCM] No token found for device ${deviceId}`);
      return;
    }

    const message = {
      token: device.fcmToken,
      data: {
        type: type, // "LOCK" or "UNLOCK"
        ...extraData,
      },
      android: {
        priority: "high",
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] Sent ${type} to ${deviceId}:`, response);
  } catch (error) {
    console.error(`[FCM] Error sending ${type} to ${deviceId}:`, error);
  }
};

exports.registerDevice = async (req, res) => {
  try {
    const { deviceId, loanId, customerId, fcmToken } = req.body;

    // Validate if loan exists
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    // Auto-approve the loan when device calls home
    if (loan.loanStatus !== "APPROVED") {
      loan.loanStatus = "APPROVED";
      await loan.save();
    }

    let device = await Device.findOne({ deviceId });

    if (device) {
      // Update existing device
      device.loanId = loanId;
      device.customerId = customerId;
      device.fcmToken = fcmToken;
      device.lastSync = Date.now();
      await device.save();
    } else {
      // Create new device
      device = await Device.create({
        deviceId,
        loanId,
        customerId,
        fcmToken,
      });
    }

    res.status(200).json({
      success: true,
      message: "Device registered successfully",
      device,
    });
  } catch (error) {
    console.error("Register Device Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.lockDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const isValidId = mongoose.Types.ObjectId.isValid(deviceId);
    const lookupFilter = {
      $or: [
        { deviceId },
        { imei1: deviceId },
        ...(isValidId ? [{ customerId: deviceId }, { _id: deviceId }] : []),
      ],
    };

    let device = await Device.findOneAndUpdate(
      lookupFilter,
      { isLocked: true, lockStatus: "LOCKED" },
      { new: true },
    );

    if (!device) {
      device = await Device.create({
        deviceId,
        imei1: deviceId,
        isLocked: true,
        lockStatus: "LOCKED",
        status: "ACTIVATED",
      }).catch(() => null);
    }

    // Send Command via FCM if token exists
    await sendFCMCommand(deviceId, "LOCK", {
      message: "EMI Overdue. Please Pay.",
    });

    res.json({
      success: true,
      message: "Lock command sent",
      lockStatus: "LOCKED",
      isLocked: true,
      device: device || { deviceId, isLocked: true, lockStatus: "LOCKED" },
    });
  } catch (error) {
    console.error("Lock Device Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.unlockDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const isValidId = mongoose.Types.ObjectId.isValid(deviceId);
    const lookupFilter = {
      $or: [
        { deviceId },
        { imei1: deviceId },
        ...(isValidId ? [{ customerId: deviceId }, { _id: deviceId }] : []),
      ],
    };

    let device = await Device.findOneAndUpdate(
      lookupFilter,
      { isLocked: false, lockStatus: "UNLOCKED" },
      { new: true },
    );

    if (!device) {
      device = await Device.create({
        deviceId,
        imei1: deviceId,
        isLocked: false,
        lockStatus: "UNLOCKED",
        status: "ACTIVATED",
      }).catch(() => null);
    }

    // Send Command via FCM if token exists
    await sendFCMCommand(deviceId, "UNLOCK");

    res.json({
      success: true,
      message: "Unlock command sent",
      lockStatus: "UNLOCKED",
      isLocked: false,
      device: device || { deviceId, isLocked: false, lockStatus: "UNLOCKED" },
    });
  } catch (error) {
    console.error("Unlock Device Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId }).populate("loanId");

    if (!device) return res.status(404).json({ message: "Device not found" });

    res.json({ success: true, device });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;

    const device = await Device.findOneAndUpdate({ deviceId }, updates, {
      new: true,
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json({
      success: true,
      message: "Device updated successfully",
      device,
    });
  } catch (error) {
    console.error("Update Device Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
