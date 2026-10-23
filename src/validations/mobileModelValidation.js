const Joi = require("joi");

const createModelSchema = Joi.object({
  modelName: Joi.string().trim().required().messages({
    "string.empty": "Model name is required",
  }),
  brandId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Brand ID is required",
      "string.pattern.base": "Brand ID must be a valid ObjectId",
    }),
});

const updateModelSchema = Joi.object({
  modelName: Joi.string().trim().optional(),
  brandId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
}).min(1);

module.exports = { createModelSchema, updateModelSchema };
