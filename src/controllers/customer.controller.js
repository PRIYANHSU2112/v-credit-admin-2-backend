const Customer = require("../models/Customer.model");
const User = require("../models/UserModel");
const Loan = require("../models/CustomerLoan.model");
const Address = require("../models/CustomerAddress.model");

const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { sendOtpViaMSG91 } = require("../utils/sms");
const { generateOtpCode, isFixedOtp } = require("../utils/otp");
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "set-a-secure-jwt-secret";
const DEFAULT_OTP_LENGTH = parseInt(process.env.PHONE_OTP_LENGTH || "4", 10);
const DEFAULT_EXPIRY_MINUTES = parseInt(
  process.env.PHONE_OTP_EXPIRY_MINUTES || "10",
  10,
);
const MAX_OTP_ATTEMPTS = parseInt(
  process.env.PHONE_OTP_MAX_ATTEMPTS || "5",
  10,
);
const OTP_SALT_ROUNDS = parseInt(
  process.env.PHONE_OTP_SALT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || "10",
  10,
);

function getExpiryDate(minutes = DEFAULT_EXPIRY_MINUTES) {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}
const registerCustomer = async (req, res) => {
  const { customerName, customerMobileNumber, address } = req.body;
  try {
    const existingVerifiedCustomer = await Customer.findOne({
      customerMobileNumber,
      createdBy: req.userId,
    });
    if (existingVerifiedCustomer) {
      return res.status(400).json({
        success: false,
        message: "A customer with this mobile number already exist.",
      });
    }

    const customer = await Customer.create({
      customerName,
      customerMobileNumber,
      address,
      createdBy: req.userId,
      isVerified: false,
    });

    // Create a User record immediately for login/FCM (even if not verified yet)
    const existingUser = await User.findOne({ phone: customerMobileNumber });
    if (!existingUser) {
      await User.create({
        phone: customerMobileNumber,
        role: "user",
        name: customerName,
        isProfileCompleted: true,
      });
    }

    res.status(200).json({
      success: true,
      customer,
      message: "user created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error Creating User",
      error: error.message,
    });
  }
};

const sendCustomerOtp = async (req, res) => {
  const { customerName, customerMobileNumber, address, email, alternatePhone } =
    req.body;
  // await Customer.collection.dropIndex('customerMobileNumber_1');

  // if (!customerName || !customerMobileNumber || !address) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "Name, Mobile Number, and Address are required.",
  //   });
  // }

  try {
    const existingVerifiedCustomer = await Customer.findOne({
      customerMobileNumber,
      createdBy: req.userId,
      isVerified: true,
    });

    if (existingVerifiedCustomer) {
      // Check if User exists. If not, we allow OTP to "heal" the account.
      const existingUser = await User.findOne({ phone: customerMobileNumber });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            "A verified customer with this mobile number already exists.",
        });
      }
      // If User doesn't exist, proceed to send OTP to allow re-verification/creation
    }

    const otp = generateOtpCode();

    // Send OTP via SMS
    const otpSent = await sendOtpViaMSG91(customerMobileNumber, otp);
    if (!otpSent) {
      console.error("Failed to send OTP to customer");
      // Decide if we should return error or proceed. Proceeding for now but logging error.
    }

    const expiresAt = getExpiryDate();
    const hashedOtp = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    const phoneOtp = {
      codeHash: hashedOtp,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    };
    await Customer.findOneAndUpdate(
      { customerMobileNumber, createdBy: req.userId },
      {
        customerName,
        address,
        email: email?.trim() || undefined,
        alternatePhone: alternatePhone?.trim() || undefined,
        createdBy: req.userId,
        phoneOtp,
        expiresAt,
        isVerified: false,
      },
      { upsert: true, new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      otp,
      message: "OTP sent to customer successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message,
    });
  }
};
const verifyOtpAndCreateCustomer = async (req, res) => {
  const { customerMobileNumber, otp } = req.body;

  if (!customerMobileNumber || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Mobile Number and OTP are required." });
  }

  try {
    const customer = await Customer.findOne({
      customerMobileNumber,
      createdBy: req.userId,
    }).select("+phoneOtp.codeHash");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found. Please send OTP first.",
      });
    }
    if (customer.isVerified) {
      // Check if User account exists
      const existingUser = await User.findOne({ phone: customerMobileNumber });
      if (!existingUser) {
        // Auto-heal: Create the missing User account
        await User.create({
          phone: customerMobileNumber,
          role: "user",
          name: customer.customerName,
          isProfileCompleted: true,
        });
        return res.status(200).json({
          success: true,
          message: "Customer account restored. You can now login.",
          data: customer,
        });
      }

      return res
        .status(400)
        .json({ success: false, message: "Customer is already verified." });
    }

    const normalizedOtp = String(otp || "").trim();
    if (!normalizedOtp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    if (!isFixedOtp(normalizedOtp)) {
      if (!customer.phoneOtp?.codeHash) {
        return res.status(400).json({
          success: false,
          message: "No OTP hash found. Please request a new OTP",
        });
      }
      if (customer.phoneOtp.attempts >= MAX_OTP_ATTEMPTS) {
        return res.status(400).json({
          success: false,
          message: "Maximum OTP attempts exceeded. Please request a new OTP",
        });
      }

      const result = await bcrypt.compare(
        normalizedOtp,
        customer.phoneOtp.codeHash,
      );
      if (!result) {
        customer.phoneOtp.attempts = customer.phoneOtp.attempts + 1;
        await customer.save();
        return res
          .status(400)
          .json({ success: false, message: "Invalid OTP. Please try again" });
      }
    }

    customer.isVerified = true;
    customer.phoneOtp = undefined;
    await customer.save();

    // Create a User record for login if it doesn't exist
    const existingUser = await User.findOne({ phone: customerMobileNumber });
    if (!existingUser) {
      await User.create({
        phone: customerMobileNumber,
        role: "user",
        name: customer.customerName,
        isProfileCompleted: true,
      });
    }

    res.status(201).json({
      success: true,
      message: "Customer verified and created successfully",
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || undefined;

    const filter = {
      // Super Admin sees all customers; dealers/shop admins see only their own.
      ...(!req.isSuperAdmin && {
        createdBy: new mongoose.Types.ObjectId(req.userId),
      }),
      isVerified: true,
    };
    if (search) {
      filter.customerName = {
        $regex: search.trim(),
        $options: "i",
      };
    }
    // console.log(filter)

    // const customers = await Customer.find(filter)
    //   .skip(skip)
    //   .limit(limit)
    //   .sort({ createdAt: -1 });
    const customers = await Customer.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "loans",
          localField: "_id",
          foreignField: "customerId",
          as: "Loan",
        },
      },
      {
        $addFields: {
          activeLoans: {
            $size: {
              $filter: {
                input: "$Loan",
                as: "loan",
                cond: { $eq: ["$$loan.loanStatus", "APPROVED"] },
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalCustomers = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limit);

    const pagination = {
      totalCustomers: totalCustomers,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
    };

    res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
      data: customers,
      pagination: pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving customers",
      error: error.message,
    });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const filter = { _id: new mongoose.Types.ObjectId(req.params.id) };
    // Dealers/shop admins can only open their own customers.
    if (!req.isSuperAdmin) {
      filter.createdBy = new mongoose.Types.ObjectId(req.userId);
    }
    const check = await Customer.find(filter).populate("Address");
    const customer = await Customer.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "loans",
          localField: "_id",
          foreignField: "customerId",
          as: "Loan",
        },
      },
      {
        $lookup: {
          from: "banks",
          localField: "_id",
          foreignField: "customerId",
          as: "Bank",
        },
      },
      {
        $lookup: {
          from: "addresses",
          localField: "_id",
          foreignField: "customerId",
          as: "Address",
        },
      },
      {
        $unwind: {
          path: "$Address",
          preserveNullAndEmptyArrays: true,
        },
      },
      // {
      //   $addFields: {
      //     address: { $ifNull: ["$Address", {}] },
      //   },
      // },
      {
        $addFields: {
          activeLoans: {
            $size: {
              $filter: {
                input: "$Loan",
                as: "loan",
                cond: { $eq: ["$$loan.loanStatus", "APPROVED"] },
              },
            },
          },
        },
      },
    ]);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Customer found", data: customer[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding customer",
      error: error.message,
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const profileUrl = req?.file ? `uploads/${req.file.filename}` : undefined;
    const updateData = { ...req.body };

    if (profileUrl !== undefined) {
      updateData.profileUrl = profileUrl;
    }

    const updateFilter = { _id: req.params.id };
    if (!req.isSuperAdmin) {
      updateFilter.createdBy = req.userId;
    }
    const customer = await Customer.findOneAndUpdate(
      updateFilter,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you are not authorized",
      });
    }
    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating customer",
      error: error.message,
    });
  }
};
const deleteCustomer = async (req, res) => {
  try {
    const deleteFilter = { _id: req.params.id };
    if (!req.isSuperAdmin) {
      deleteFilter.createdBy = req.userId;
    }
    const customer = await Customer.findOne(deleteFilter);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you are not authorized",
      });
    }

    // Deep delete: Delete related Loans, Addresses, and User account
    await Loan.deleteMany({ customerId: customer._id });
    await Address.deleteMany({ customerId: customer._id });

    // Delete the User account created for this customer (if any)
    if (customer.customerMobileNumber) {
      await User.findOneAndDelete({ phone: customer.customerMobileNumber });
    }

    // Finally delete the customer
    await Customer.findByIdAndDelete(customer._id);

    res.status(200).json({
      success: true,
      message: "Customer and all related data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message,
    });
  }
};

const completeAadhaarKYC = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { aadhaarNumber } = req.body;
    const aadhaarFront = req.files["aadhaarFront"]
      ? `uploads/${req.files["aadhaarFront"][0].filename}`
      : null;
    const aadhaarBack = req.files["aadhaarBack"]
      ? `uploads/${req.files["aadhaarBack"][0].filename}`
      : null;

    // if (!aadhaarNumber || !aadhaarFront || !aadhaarBack) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "All Aadhaar fields are required" });
    // }
    const updateData = {};

    if (aadhaarNumber) updateData["kyc.aadhaar.number"] = aadhaarNumber;
    if (aadhaarFront) updateData["kyc.aadhaar.frontPhoto"] = aadhaarFront;
    if (aadhaarBack) updateData["kyc.aadhaar.backPhoto"] = aadhaarBack;

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true },
    );

    res.status(200).json({ success: true, data: updatedCustomer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const completePanKYC = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { panNumber } = req.body;
    const panPhoto = req.file ? `uploads/${req.file.filename}` : null;

    // if (!panNumber || !panPhoto) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "PAN number and photo are required" });
    // }

    const updateData = {};

    if (panNumber) updateData["kyc.pan.number"] = panNumber;
    if (panPhoto) updateData["kyc.pan.photo"] = panPhoto;

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true },
    );

    res.status(200).json({ data: updatedCustomer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const addBankPassbook = async (req, res) => {
  try {
    const customerId = req.params.id;
    const bankPassbookPhoto = req.file ? `uploads/${req.file.filename}` : null;

    if (!bankPassbookPhoto) {
      return res
        .status(400)
        .json({ success: false, message: "Bank passbook photo is required" });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { "kyc.bankPassbook.photo": bankPassbookPhoto },
      { new: true },
    );

    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  sendCustomerOtp,
  verifyOtpAndCreateCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  completeAadhaarKYC,
  completePanKYC,
  addBankPassbook,
  registerCustomer,
};
