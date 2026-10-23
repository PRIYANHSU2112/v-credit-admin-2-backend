const Joi = require("joi");

const completeProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email address",
  }),
});

const updateUserProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  email: Joi.string().trim().email().optional(),
  dateOfBirth:Joi.date().iso(),
}).or("name", "email","dateOfBirth");

const paramIdSchema = Joi.object({
  id: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid user ID format",
      "string.empty": "User ID is required",
    }),
});

module.exports = {
  completeProfileSchema,
  updateUserProfileSchema,
  paramIdSchema,
};
