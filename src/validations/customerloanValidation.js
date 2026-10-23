const Joi = require("joi");

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .message("Invalid ID format");

const installmentSchema = Joi.object({
  installmentNumber: Joi.number().integer().min(1).required(),
  dueDate: Joi.date().required(),
  amount: Joi.number().min(0).required(),
  status: Joi.string()
    .valid("PENDING", "PAID", "OVERDUE", "PARTIAL")
    .default("PENDING"),
  paidAmount: Joi.number().min(0).default(0),
  paidDate: Joi.date().optional(),
  paymentMethod: Joi.string()
    .valid("cash", "upi", "autopay/autodebit")
    .optional(),
  lateFee: Joi.number().min(0).default(0),
  remarks: Joi.string().allow("").optional(),
});

const createLoanSchema = Joi.object({
  installationType: Joi.string()
    .valid("New Phone", "Old/Running Phone")
    .required(),
  mobileBrand: Joi.string()
    // .valid("label1", "label2", "label3", "label4", "label5")
    .required(),
  mobileModel: Joi.string()
    // .valid("label1", "label2", "label3", "label4", "label5")
    .required(),
  imeiNumber1: Joi.string().length(15).required(),
  imeiNumber2: Joi.string().length(15).optional(),
  mobilePrice: Joi.number().min(0).required(),
  processingFees: Joi.number().min(0).optional(),
  downPayment: Joi.number().min(0).optional(),
  frequency: Joi.string()
    .valid("monthly", "weekly", "daily")
    .empty("")
    .default("monthly"),
  numberOfEMIs: Joi.number().integer().min(1).optional(),
  interestRate: Joi.number().min(0).optional(),
  loanAmount: Joi.number().min(0).required(),
  emiAmount: Joi.number().min(0).optional(),
  firstEmiDate: Joi.date().optional().empty(""),

  financer: Joi.string().valid("admin", "shop owner"),
  paymentOptions: Joi.string()
    .empty("")
    .valid("cash", "upi", "autopay/autodebit")
    .default("upi"),
  description: Joi.string().allow("").optional(),
  autoUnlock: Joi.boolean().optional(),
  // emiStartDate: Joi.date().optional(),
  // emiEndDate: Joi.date().optional(),
  loanStatus: Joi.string()
    .valid("APPROVED", "PENDING", "REJECTED", "CLOSED")
    .default("PENDING"),
  deviceUnlockStatus: Joi.string()
    .valid("LOCKED", "UNLOCKED")
    .default("UNLOCKED"),
  // EDITED: Allowed installments and unknown fields
  installments: Joi.array().items(installmentSchema).optional(),
}).unknown(true);

const updateLoanSchema = Joi.object({
  installationType: Joi.string().valid("New Phone", "Old/Running Phone"),
  mobileBrand: Joi.string(),
  mobileModel: Joi.string(),
  imeiNumber1: Joi.string().length(15),
  imeiNumber2: Joi.string().length(15),
  mobilePrice: Joi.number().min(0),
  processingFees: Joi.number().min(0),
  downPayment: Joi.number().min(0),
  frequency: Joi.string().valid("monthly", "weekly", "daily"),
  numberOfEMIs: Joi.number().integer().min(1),
  interestRate: Joi.number().min(0),
  loanAmount: Joi.number().min(0),
  emiAmount: Joi.number().min(0),
  firstEmiDate: Joi.date(),
  financer: Joi.string().valid("admin", "shop owner"),
  paymentOptions: Joi.string().valid("cash", "upi", "autopay/autodebit"),
  description: Joi.string().allow(""),
  autoUnlock: Joi.boolean(),
  emiStartDate: Joi.date(),
  emiEndDate: Joi.date(),
  loanStatus: Joi.string().valid("APPROVED", "PENDING", "REJECTED", "CLOSED"),
  deviceUnlockStatus: Joi.string().valid("LOCKED", "UNLOCKED"),
  installments: Joi.array().items(installmentSchema),
})
  .min(1)
  .unknown(true);

const paramIdSchema = Joi.object({
  customerId: objectId.optional(),
  loanId: objectId.optional(),
});

module.exports = {
  createLoanSchema,
  updateLoanSchema,
  paramIdSchema,
};
