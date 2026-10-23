const Joi = require("joi");

exports.cityValidation = Joi.object({
  cityName: Joi.string().trim().required().messages({
    "string.empty": "City name is required",
  }),
  stateId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "State ID is required",
      "string.pattern.base": "Invalid State ID format",
    }),
});

exports.updateCityValidation = Joi.object({
  cityName: Joi.string().trim().optional(),
  stateId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid State ID format",
    }),
}).min(1);
