const Joi = require("joi");

const createAddressSchema = Joi.object({
  customerAddress: Joi.string().min(3).max(255).required().messages({
    "string.base": "Customer address must be a string",
    "string.empty": "Customer address is required",
    "string.min": "Customer address must be at least 3 characters long",
  }),
  customerState: Joi.string()
    .required()
    .messages({
      "any.only": "Invalid state selected",
      "string.empty": "Customer state is required",
    }),
  customerCity: Joi.string()
    .required()
    .messages({
      "any.only": "Invalid city selected",
      "string.empty": "Customer city is required",
    }),
  landmark: Joi.string().allow("", null),
  customerProfession: Joi.string().allow("", null),
  customerSalary: Joi.number().min(0).allow(null).messages({
    "number.base": "Salary must be a number",
  }),
  customerContact1: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Contact 1 must be a valid 10-digit number",
      "string.empty": "Contact 1 is required",
    }),
  customerContact2: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "Contact 2 must be a valid 10-digit number",
    }),
  otherInfo: Joi.string().allow("", null),
});

const updateAddressSchema = Joi.object({
  customerAddress: Joi.string().min(3).max(255),
  customerState: Joi.string()
    .required()
    .messages({
      "any.only": "Invalid state selected",
      "string.empty": "Customer state is required",
    }),
  customerCity: Joi.string()
    .required()
    .messages({
      "any.only": "Invalid city selected",
      "string.empty": "Customer city is required",
    }),
  landmark: Joi.string().allow("", null),
  customerProfession: Joi.string().allow("", null),
  customerSalary: Joi.number().min(0).allow(null),
  customerContact1: Joi.string().pattern(/^[0-9]{10}$/),
  customerContact2: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .allow("", null),
  otherInfo: Joi.string().allow("", null),
});

const paramIdSchema = Joi.object({
  customerId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid customer ID format",
      "string.empty": "Customer ID is required",
    }),
  addressId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid address ID format",
    }),
});

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  paramIdSchema,
};
