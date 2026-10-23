const Joi = require("joi");

const createContactUsSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "Name is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be a 10-digit number",
      "string.empty": "Phone number is required",
    }),
  message: Joi.string().trim().required().messages({
    "string.empty": "Message is required",
  }),
});

module.exports = { createContactUsSchema };
