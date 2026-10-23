const FIXED_OTP = "1234";

const generateOtpCode = () => FIXED_OTP;

const isFixedOtp = (code) => String(code || "").trim() === FIXED_OTP;

module.exports = {
  FIXED_OTP,
  generateOtpCode,
  isFixedOtp,
};
