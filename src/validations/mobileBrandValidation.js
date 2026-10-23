const Joi = require("joi");

const createBrandSchema = Joi.object({
  brandName: Joi.string().trim().required().messages({
    "string.empty": "Brand name is required",
  }),
});

const updateBrandSchema = Joi.object({
  brandName: Joi.string().trim().optional(),
}).min(1);

module.exports = { createBrandSchema, updateBrandSchema };
