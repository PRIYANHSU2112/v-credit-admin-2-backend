const Joi = require("joi");

const sendCustomerOtpSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Customer name is required",
    "string.min": "Customer name must have at least 2 characters",
  }),
  customerMobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.empty": "Customer mobile number is required",
      "string.pattern.base": "Mobile number must be 10 digits",
    }),
  address: Joi.string().trim().min(5).required().messages({
    "string.empty": "Address is required",
    "string.min": "Address must have at least 5 characters",
  }),
  email: Joi.string().trim().email().allow("", null).optional().messages({
    "string.email": "Invalid email format",
  }),
  alternatePhone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .allow("", null)
    .optional()
    .messages({
      "string.pattern.base": "Alternate phone must be 10 digits",
    }),
});

const verifyCustomerOtpSchema = Joi.object({
  customerMobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.empty": "Customer mobile number is required",
      "string.pattern.base": "Mobile number must be 10 digits",
    }),
  otp: Joi.string()
    .length(4)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.empty": "OTP is required",
      "string.length": "OTP must be 4 digits",
      "string.pattern.base": "OTP must be numeric",
    }),
});

const updateCustomerSchema = Joi.object({
  customerName: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Customer name must have at least 2 characters",
    "string.max": "Customer name must not exceed 50 characters",
  }),
  customerMobileNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 10 digits",
    }),
  address: Joi.string().trim().min(5).optional().messages({
    "string.min": "Address must have at least 5 characters",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Invalid email format",
  }),
  isVerified: Joi.boolean().optional(),
  "kyc.aadhaar.number": Joi.string().optional(),
  "kyc.pan.number": Joi.string().optional(),
}).min(1);

const aadhaarKycSchema = Joi.object({
  aadhaarNumber: Joi.string()
    .pattern(/^[0-9]{12}$/)
    .required()
    .messages({
      "string.empty": "Aadhaar number is required",
      "string.pattern.base": "Aadhaar number must be exactly 12 digits",
    }),
});

const panKycSchema = Joi.object({
  panNumber: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .required()
    .messages({
      "string.empty": "PAN number is required",
      "string.pattern.base": "Invalid PAN format (e.g. ABCDE1234F)",
    }),
});

const bankPassbookSchema = Joi.object({
  dummy: Joi.string().optional(),
});

module.exports = {
  sendCustomerOtpSchema,
  verifyCustomerOtpSchema,
  aadhaarKycSchema,
  panKycSchema,
  bankPassbookSchema,
  updateCustomerSchema,
};
