const Joi = require("joi");

exports.stateValidation = Joi.object({
  stateName: Joi.string().trim().required().messages({
    "string.empty": "State name is required",
  }),
});

exports.updateStateValidation = Joi.object({
  stateName: Joi.string().trim().optional(),
}).min(1);
