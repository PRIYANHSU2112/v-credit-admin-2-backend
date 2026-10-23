const Joi = require("joi");
const { COMMAND_TYPES } = require("../models/RemoteCommand.model");

const phone = Joi.string().pattern(/^[0-9]{10}$/).messages({
  "string.pattern.base": "Phone number must be a valid 10-digit number.",
});

exports.requestOtpSchema = Joi.object({
  phone: phone.required(),
  type: Joi.string().optional(),
}).unknown(true);

exports.loginSchema = Joi.object({
  phone: phone.optional(),
  otpCode: Joi.string().optional(),
  customerId: Joi.string().optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().optional(),
  deviceId: Joi.string().optional(),
})
  .or("phone", "customerId", "email")
  .unknown(true);

exports.refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).unknown(true);

exports.logoutSchema = Joi.object({
  refreshToken: Joi.string().optional().allow(""),
}).unknown(true);

// Device info payload (activation + registration). Lenient — device sends many fields.
exports.activateSchema = Joi.object({
  imei: Joi.string().optional().allow(""),
  androidId: Joi.string().optional().allow(""),
  fcmToken: Joi.string().optional().allow(""),
  deviceModel: Joi.string().optional().allow(""),
  brand: Joi.string().optional().allow(""),
  manufacturer: Joi.string().optional().allow(""),
  androidVersion: Joi.string().optional().allow(""),
  securityPatch: Joi.string().optional().allow(""),
  simInfo: Joi.any().optional(),
  permissions: Joi.object().optional(),
  isRooted: Joi.boolean().optional(),
  isEmulator: Joi.boolean().optional(),
  appVersion: Joi.string().optional().allow(""),
})
  .or("imei", "androidId")
  .unknown(true);

exports.registerDeviceSchema = exports.activateSchema;

exports.heartbeatSchema = Joi.object({
  deviceId: Joi.string().required(),
  battery: Joi.number().optional(),
  networkType: Joi.string().optional().allow(""),
  currentScreen: Joi.string().optional().allow(""),
  appVersion: Joi.string().optional().allow(""),
  location: Joi.object({
    latitude: Joi.number(),
    longitude: Joi.number(),
    accuracy: Joi.number(),
  }).optional(),
}).unknown(true);

exports.commandAckSchema = Joi.object({
  commandRef: Joi.string().required(),
  status: Joi.string().valid("SUCCESS", "FAILED", "ERROR").required(),
  resultMessage: Joi.string().optional().allow(""),
  executionTimeMs: Joi.number().optional(),
}).unknown(true);

exports.commandIssueSchema = Joi.object({
  deviceId: Joi.string().required(),
  type: Joi.string().valid(...COMMAND_TYPES).required(),
  payload: Joi.object().optional(),
}).unknown(true);
