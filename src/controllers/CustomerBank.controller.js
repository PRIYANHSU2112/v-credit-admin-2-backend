const Bank = require("../models/CustomerBank.model");
const User = require("../models/UserModel");
const addBank = async (req, res) => {
  try {
    const userId = req.userId;
    const { bankName, accountNumber, accountHolderName, ifscCode, upiId } =
      req.body;

    if (!bankName || !accountNumber || !accountHolderName || !ifscCode) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not found" });
    }

    const bank = await Bank.create({
      userId,
      bankName,
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId: upiId || "",
    });

    res
      .status(201)
      .json({ success: true, message: "Bank added successfully", data: bank });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding bank",
      error: error.message,
    });
  }
};

const getBanksByCustomer = async (req, res) => {
  try {
    const userId = req.userId;
    const banks = await Bank.find({ userId });

    res.status(200).json({
      success: true,
      message: "Banks retrieved successfully",
      data: banks,
      total: banks.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving banks",
      error: error.message,
    });
  }
};
const getBankById = async (req, res) => {
  try {
    const { bankId } = req.params;
    const bank = await Bank.findById(bankId);

    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank not found" });
    }

    res.status(200).json({
      success: true,
      message: "Bank retrieved successfully",
      data: bank,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving bank",
      error: error.message,
    });
  }
};

const updateBank = async (req, res) => {
  try {
    const { bankId } = req.params;
    const updates = req.body;

    const bank = await Bank.findByIdAndUpdate(bankId, updates, { new: true });

    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank not found" });
    }

    res.status(200).json({
      success: true,
      message: "Bank updated successfully",
      data: bank,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating bank",
      error: error.message,
    });
  }
};

const deleteBank = async (req, res) => {
  try {
    const { bankId } = req.params;
    const bank = await Bank.findByIdAndDelete(bankId);

    if (!bank) {
      return res
        .status(404)
        .json({ success: false, message: "Bank not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Bank deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting bank",
      error: error.message,
    });
  }
};

module.exports = {
  addBank,
  getBanksByCustomer,
  getBankById,
  updateBank,
  deleteBank,
};
