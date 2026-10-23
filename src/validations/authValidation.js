const Joi = require("joi");

exports.sendOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be a valid 10-digit number.",
      "any.required": "Phone number is required.",
    }),
  // [MODIFIED] Added optional 'type' field to allow 'login' flag in request body
  type: Joi.string().optional(),
});

exports.verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be a valid 10-digit number.",
      "any.required": "Phone number is required.",
    }),
  otpCode: Joi.string().length(4).required().messages({
    "string.length": "OTP must be 4 digits long.",
    "any.required": "OTP code is required.",
  }),
  imei: Joi.string().optional().allow(""),
  isCustomer: Joi.boolean().optional(),
});
