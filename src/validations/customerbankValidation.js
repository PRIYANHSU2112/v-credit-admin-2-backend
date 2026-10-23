const Joi = require("joi");

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const paramIdSchema = Joi.object({
  customerId: Joi.string().pattern(objectIdPattern).optional().messages({
    "string.pattern.base": "Invalid customer ID format",
  }),
  bankId: Joi.string().pattern(objectIdPattern).optional().messages({
    "string.pattern.base": "Invalid bank ID format",
  }),
});

const addBankSchema = Joi.object({
  bankName: Joi.string().trim().required().messages({
    "string.empty": "Bank name is required",
  }),
  accountNumber: Joi.string()
    .pattern(/^[0-9]{9,18}$/)
    .required()
    .messages({
      "string.empty": "Account number is required",
      "string.pattern.base": "Account number must be 9–18 digits",
    }),
  accountHolderName: Joi.string().trim().required().messages({
    "string.empty": "Account holder name is required",
  }),
  ifscCode: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "IFSC code is required",
      "string.pattern.base": "Invalid IFSC code format",
    }),
});

const updateBankSchema = Joi.object({
  bankName: Joi.string().trim().optional(),
  accountNumber: Joi.string()
    .pattern(/^[0-9]{9,18}$/)
    .optional(),
  accountHolderName: Joi.string().trim().optional(),
  ifscCode: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .optional(),
}).min(1);

module.exports = {
  paramIdSchema,
  addBankSchema,
  updateBankSchema,
};
