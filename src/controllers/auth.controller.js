const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");
const Loan = require("../models/CustomerLoan.model");
const Customer = require("../models/Customer.model");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const { sendOtpViaMSG91 } = require("../utils/sms");
const { generateOtpCode, isFixedOtp } = require("../utils/otp");

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "set-a-secure-jwt-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEFAULT_OTP_LENGTH = parseInt(process.env.PHONE_OTP_LENGTH || "6", 10);
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
function generateOTP() {
  return generateOtpCode();
}
const registerAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingAdmin = await User.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newAdmin = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
    });
    const tokenPayload = {
      userId: newAdmin._id,
      role: newAdmin.role,
      enterpriseRole: newAdmin.enterpriseRole || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: {
        id: newAdmin._id,

        email: newAdmin.email,
        token,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const input = (req.body.email || req.body.identifier || "").trim();
    const { password, enterpriseRole } = req.body;

    if (!input || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email or phone and password",
      });
    }

    const query = {
      isDeleted: { $ne: true },
      $or: [
        { email: input.toLowerCase() },
        { phone: input },
      ],
    };
    if (enterpriseRole) {
      query.enterpriseRole = enterpriseRole;
    }

    const admin = await User.findOne(query).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (admin.isDisabled === true) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    const tokenPayload = {
      userId: admin._id,
      role: admin.role,
      enterpriseRole: admin.enterpriseRole || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    let parentName = null;
    if (admin.parentId) {
      const parentUser = await User.findById(admin.parentId).select("name");
      if (parentUser) parentName = parentUser.name;
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        enterpriseRole: admin.enterpriseRole || "super_admin",
        parentId: admin.parentId || null,
        parentName,
        entityCode: admin.entityCode || null,
        city: admin.city || null,
        territory: admin.territory || null,
        keys: admin.keys ?? 0,
        isProfileCompleted: admin.isProfileCompleted || true,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { phone, type } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    // [NEW] Enforce Customer Check
    const searchPhone = phone.replace(/\D/g, "").slice(-10);
    const customer = await Customer.findOne({
      customerMobileNumber: { $regex: `${searchPhone}$` },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Please create customer. This number is not registered.",
      });
    }

    // Check if Customer is banned/disabled
    if (customer.isDisabled || customer.isBanned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        message: "Your account has been suspended or banned. Please contact support.",
      });
    }

    let user = await User.findOne({ phone }).select("+phoneOtp.codeHash");

    // Check if User account is banned/disabled
    if (user && (user.isDisabled || user.isBanned || user.isDeleted)) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        message: "Your account has been suspended or banned. Please contact support.",
      });
    }

    if (!user) {
      user = new User({
        phone,
      });
    }

    const now = new Date();
    if (user.phoneOtp?.lastSentAt) {
      const timeSinceLastOtp = now - new Date(user.phoneOtp.lastSentAt);
      const cooldownPeriod = 60 * 1000;

      if (timeSinceLastOtp < cooldownPeriod) {
        const waitTime = Math.ceil((cooldownPeriod - timeSinceLastOtp) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting another OTP`,
        });
      }
    }
    const dailyLimit = 5;
    if (user.phoneOtp?.attempts >= dailyLimit) {
      const lastAttemptDate = new Date(user.phoneOtp.lastSentAt);
      const hoursSinceLastAttempt = (now - lastAttemptDate) / (1000 * 60 * 60);

      if (hoursSinceLastAttempt < 24) {
        return res.status(429).json({
          success: false,
          message: "Daily OTP limit reached. Please try again after 24 hours",
        });
      } else {
        user.phoneOtp.attempts = 0;
      }
    }
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otp = generateOTP();
    const otpSent = await sendOtpViaMSG91(phone, otp);
    if (!otpSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again",
      });
    }
    const expiresAt = getExpiryDate();
    const hashedOtp = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    user.phoneOtp = {
      codeHash: hashedOtp,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    };

    await user.save();
    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        phone: user.phone,
        // OTP is only echoed back outside production (dev/testing when SMS is not configured)
        ...(IS_PRODUCTION ? {} : { otp }),
        expiresAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
  const { phone, otpCode, imei, isCustomer } = req.body;
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required to verify OTP",
    });
  }

  const user = await User.findOne({ phone }).select("+phoneOtp.codeHash");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Number is not registered",
    });
  }

  // Check if User is banned or disabled
  if (user.isDisabled || user.isBanned || user.isDeleted) {
    return res.status(403).json({
      success: false,
      isBanned: true,
      message: "Your account has been suspended or banned. Please contact support.",
    });
  }

  // Check if Customer is banned or disabled
  const searchPhoneVerify = phone.replace(/\D/g, "").slice(-10);
  const customerVerify = await Customer.findOne({
    customerMobileNumber: { $regex: `${searchPhoneVerify}$` },
  });
  if (customerVerify && (customerVerify.isDisabled || customerVerify.isBanned)) {
    return res.status(403).json({
      success: false,
      isBanned: true,
      message: "Your account has been suspended or banned. Please contact support.",
    });
  }

  const normalizedOtp = String(otpCode || "").trim();
  if (!normalizedOtp) {
    return res.status(400).json({ success: false, message: "OTP is required" });
  }

  if (!isFixedOtp(normalizedOtp)) {
    if (!user.phoneOtp || !user.phoneOtp.codeHash) {
      return res.status(400).json({
        success: false,
        message: "No OTP is pending verification for this user",
      });
    }

    if (!user.phoneOtp.expiresAt || new Date(user.phoneOtp.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP",
      });
    }

    if (user.phoneOtp.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please request a new OTP",
      });
    }

    const result = await bcrypt.compare(normalizedOtp, user.phoneOtp.codeHash);
    if (!result) {
      user.phoneOtp.attempts = user.phoneOtp.attempts + 1;
      await user.save();
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again" });
    }
  }

  user.isVerified = true;
  user.phoneOtp = undefined;
  await user.save();

  // [NEW] Dynamic IMEI Binding Logic
  let loan = null;
  if (imei && user.role !== "admin") {
    try {
      // Find customer associated with this user phone
      // Normalize user phone: keep last 10 digits
      const userPhone = user.phone
        ? String(user.phone).replace(/\D/g, "").slice(-10)
        : "";

      if (userPhone) {
        // Find customer with this phone
        const customer = await Customer.findOne({
          customerMobileNumber: { $regex: `${userPhone}$` },
        });

        if (customer) {
          // Find the latest APPROVED loan for this customer
          // We update the loan to match the device the user is currently logging into
          loan = await Loan.findOne({
            customerId: customer._id,
            loanStatus: "APPROVED",
          }).sort({ createdAt: -1 });

          if (loan) {
            loan.imeiNumber1 = imei;
            // The polling service will handle lock/unlock.
            await loan.save();
          }
        }
      }
    } catch (bindError) {
      console.error("Error binding IMEI during login:", bindError);
      // Don't block login if binding fails, just log it
    }
  }
  // OTP login is the Customer Login flow. Even if this phone also belongs to a
  // dealer/admin account, when they log in via "Customer Login" we treat them as
  // a customer so their own loan/EMI dashboard is shown (not the dealer stats).
  const loginMode = isCustomer ? "customer" : user.role === "admin" ? "dealer" : "user";

  const tokenPayload = {
    userId: user.id,
    role: user.role,
    loginMode,
    enterpriseRole: user.enterpriseRole || null,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  // Fetch customer name for better UX
  let customerName = null;
  const searchPhone = user.phone.replace(/\D/g, "").slice(-10);
  const customer = await Customer.findOne({
    customerMobileNumber: { $regex: `${searchPhone}$` },
  });
  if (customer) {
    customerName = customer.customerName;
  }

  return res.status(200).json({
    success: true,
    data: {
      isProfileCompleted: user.isProfileCompleted,
      userId: user.id,
      phone: user.phone,
      name: customerName,
      // In the customer login flow the app UI must behave as a customer even if
      // the underlying account is a dealer/admin (same phone used for both).
      role: isCustomer ? "user" : user.role,
      loanId: loan ? loan._id : null,
      token,
    },
  });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    });
  }
};

const checkBanStatus = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    const searchPhone = String(phone).replace(/\D/g, "").slice(-10);
    const customer = await Customer.findOne({
      customerMobileNumber: { $regex: `${searchPhone}$` },
    });
    const user = await User.findOne({
      phone: { $regex: `${searchPhone}$` },
    });

    if (!customer && !user) {
      return res.status(404).json({
        success: false,
        message: "No customer or user account found with this number.",
      });
    }

    const isBanned = (customer && (customer.isDisabled || customer.isBanned)) || (user && (user.isDisabled || user.isBanned)) || false;
    const name = customer?.customerName || user?.name || "Customer";

    return res.status(200).json({
      success: true,
      found: true,
      phone: searchPhone,
      name,
      isBanned: !!isBanned,
      isDisabled: !!isBanned,
      message: isBanned ? "Account is currently BANNED / SUSPENDED" : "Account is currently ACTIVE",
    });
  } catch (err) {
    console.error("checkBanStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const toggleBanByPhone = async (req, res) => {
  try {
    const { phone, isBanned } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    const searchPhone = String(phone).replace(/\D/g, "").slice(-10);

    const customer = await Customer.findOne({
      customerMobileNumber: { $regex: `${searchPhone}$` },
    });
    const user = await User.findOne({
      phone: { $regex: `${searchPhone}$` },
    });

    if (!customer && !user) {
      return res.status(404).json({
        success: false,
        message: "No customer or user found with this number to ban/unban.",
      });
    }

    const currentStatus = (customer && (customer.isDisabled || customer.isBanned)) || (user && (user.isDisabled || user.isBanned)) || false;
    const targetStatus = typeof isBanned === "boolean" ? isBanned : !currentStatus;

    await Customer.updateMany(
      { customerMobileNumber: { $regex: `${searchPhone}$` } },
      { $set: { isDisabled: targetStatus, isBanned: targetStatus } }
    );

    await User.updateMany(
      { phone: { $regex: `${searchPhone}$` } },
      { $set: { isDisabled: targetStatus, isBanned: targetStatus } }
    );

    return res.status(200).json({
      success: true,
      phone: searchPhone,
      isBanned: targetStatus,
      isDisabled: targetStatus,
      message: `Account +91 ${searchPhone} has been ${targetStatus ? "BANNED / SUSPENDED" : "ACTIVATED / UNBANNED"} successfully.`,
    });
  } catch (err) {
    console.error("toggleBanByPhone error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  loginAdmin,
  sendOtp,
  verifyOtp,
  registerAdmin,
  checkBanStatus,
  toggleBanByPhone,
};
