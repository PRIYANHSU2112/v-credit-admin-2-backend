const express = require("express");
const {
  createCustomerloan,
  getAllCustomersloan,
  getCustomerloanById,
  updateCustomerloan,
  deleteCustomerloan,
  getAllloans,
  getMyLoans,
  getDueInstallments,
  lockDevice,
  unlockDevice,
  getMobileDeviceStatus,
  getDeviceStatusByImei,
  updateDevicePolicy,
  lockDeviceBulk,
  unlockDeviceBulk,
  updateDevicePolicyBulk,
  requestDeviceLocation,
  requestDeviceSimInfo,
  requestDeviceLocationBulk,
  requestDeviceSimInfoBulk,
  markAutoDebitFailure,
  updateSimDetails,
  getSimDetails,
  updateLocation,
  recordFullPayment,
} = require("../controllers/CustomerLoan.controller.js");
const authMiddleware = require("../middleware/auth.middleware.js");
const validateRequest = require("../middleware/validateRequest.js");
const {
  createLoanSchema,
  updateLoanSchema,
  paramIdSchema,
} = require("../validations/customerloanValidation.js");

const router = express.Router({ mergeParams: true });

// PUBLIC ROUTES (No Auth)
router.get("/status/public", getDeviceStatusByImei);
router.post("/location", updateLocation);
router.post("/device/sim", updateSimDetails);

// PROTECTED ROUTES
router.use(authMiddleware);

router.get("/my-loans", getMyLoans);
router.get("/dueInstallments", getDueInstallments);
router.get("/mobile/status", getMobileDeviceStatus);
router.get("/:customerId", getAllCustomersloan);

router.get("/", getAllloans);

router.post(
  "/:customerId",
  validateRequest(createLoanSchema),
  createCustomerloan,
);

router.get("/single/:loanId", getCustomerloanById);

router.put("/:loanId", validateRequest(updateLoanSchema), updateCustomerloan);
router.post("/pay/:loanId", recordFullPayment);

router.delete("/:loanId", deleteCustomerloan);

router.post("/lock/:loanId", lockDevice);
router.post("/unlock/:loanId", unlockDevice);
router.post("/policy/:loanId", updateDevicePolicy);

router.post("/bulk/lock", lockDeviceBulk);
router.post("/bulk/unlock", unlockDeviceBulk);
router.post("/bulk/policy", updateDevicePolicyBulk);

// Location & SIM Request Routes
router.post("/location/request/:loanId", requestDeviceLocation);
router.post("/location/sim/request/:loanId", requestDeviceSimInfo);
router.post("/bulk/location", requestDeviceLocationBulk);
router.post("/bulk/sim", requestDeviceSimInfoBulk);
router.post("/bounce/:loanId", markAutoDebitFailure);

// SIM Details
router.get("/sim/:loanId", getSimDetails);

module.exports = router;
