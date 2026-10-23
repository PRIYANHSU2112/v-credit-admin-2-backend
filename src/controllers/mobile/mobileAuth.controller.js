const bcrypt = require("bcrypt");
const User = require("../../models/UserModel");
const Customer = require("../../models/Customer.model");
const { sendOtp } = require("../auth.controller");
const { isFixedOtp } = require("../../utils/otp");
const {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
} = require("../../services/mobile/mobileAuth.service");

const MAX_OTP_ATTEMPTS = parseInt(process.env.PHONE_OTP_MAX_ATTEMPTS || "5", 10);

const reqCtx = (req) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"],
  deviceId: req.body.deviceId,
});

// STEP 2: request OTP — reuses the shared SMS + rate-limit pipeline.
const requestOtp = (req, res) => sendOtp(req, res);

/**
 * STEP 2: login with phone + OTP, or customerId/email + password.
 * Issues a JWT access token + rotating refresh token.
 */
const login = async (req, res) => {
  try {
    const { phone, otpCode, customerId, password } = req.body;

    let user = null;

    if (phone && otpCode) {
      user = await User.findOne({ phone }).select("+phoneOtp.codeHash");
      if (!user) {
        return res
          .status(404)
          .json({ success: false, code: "NOT_REGISTERED", message: "Number is not registered" });
      }
      if (!isFixedOtp(otpCode)) {
        if (!user.phoneOtp || !user.phoneOtp.codeHash) {
          return res
            .status(400)
            .json({ success: false, code: "NO_OTP", message: "No OTP pending. Request a new one." });
        }
        if (!user.phoneOtp.expiresAt || new Date(user.phoneOtp.expiresAt) < new Date()) {
          return res
            .status(400)
            .json({ success: false, code: "OTP_EXPIRED", message: "OTP has expired" });
        }
        if (user.phoneOtp.attempts >= MAX_OTP_ATTEMPTS) {
          return res
            .status(400)
            .json({ success: false, code: "OTP_LOCKED", message: "Too many attempts. Request a new OTP." });
        }
        const ok = await bcrypt.compare(String(otpCode).trim(), user.phoneOtp.codeHash);
        if (!ok) {
          user.phoneOtp.attempts += 1;
          await user.save();
          return res
            .status(400)
            .json({ success: false, code: "INVALID_OTP", message: "Invalid OTP" });
        }
      }
      user.isVerified = true;
      user.phoneOtp = undefined;
      await user.save();
    } else if ((customerId || req.body.email) && password) {
      const query = req.body.email
        ? { email: String(req.body.email).toLowerCase() }
        : { $or: [{ _id: safeId(customerId) }, { entityCode: customerId }, { phone: customerId }] };
      user = await User.findOne(query).select("+password");
      if (!user || !user.password) {
        return res
          .status(401)
          .json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res
          .status(401)
          .json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: "MISSING_CREDENTIALS",
        message: "Provide phone+otpCode or customerId/email+password",
      });
    }

    if (user.isDisabled || user.isDeleted) {
      return res
        .status(403)
        .json({ success: false, code: "ACCOUNT_DISABLED", message: "Account is disabled" });
    }

    const tokens = await issueTokens(user, reqCtx(req));

    // best-effort customer name
    let customerName = null;
    if (user.phone) {
      const searchPhone = user.phone.replace(/\D/g, "").slice(-10);
      const customer = await Customer.findOne({
        customerMobileNumber: { $regex: `${searchPhone}$` },
      });
      customerName = customer?.customerName || null;
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user._id,
        phone: user.phone,
        name: user.name || customerName,
        role: user.role,
        enterpriseRole: user.enterpriseRole || null,
        isProfileCompleted: user.isProfileCompleted,
        ...tokens,
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error.message);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

const safeId = (val) => {
  const mongoose = require("mongoose");
  return mongoose.Types.ObjectId.isValid(val) ? val : null;
};

// Rotate refresh → new access + refresh pair.
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, code: "NO_REFRESH", message: "refreshToken required" });
    }

    // Decode userId from the stored token record to reload the user.
    const RefreshToken = require("../../models/RefreshToken.model");
    const crypto = require("crypto");
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const record = await RefreshToken.findOne({ tokenHash });
    if (!record) {
      return res
        .status(401)
        .json({ success: false, code: "INVALID_REFRESH", message: "Invalid refresh token" });
    }
    const user = await User.findById(record.userId);
    if (!user || user.isDisabled || user.isDeleted) {
      return res
        .status(403)
        .json({ success: false, code: "ACCOUNT_DISABLED", message: "Account is disabled" });
    }

    const tokens = await rotateRefreshToken(refreshToken, user, reqCtx(req));
    return res.status(200).json({ success: true, data: tokens });
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, code: "REFRESH_FAILED", message: error.message });
  }
};

// STEP 13: logout — revoke the presented refresh token.
const logout = async (req, res) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    return res.status(200).json({ success: true, message: "Logged out" });
  }
};

module.exports = { requestOtp, login, refresh, logout };
