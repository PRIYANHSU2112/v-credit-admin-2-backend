const express = require("express");
const {
  sendCustomerOtp,
  verifyOtpAndCreateCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  completeAadhaarKYC,
  completePanKYC,
  addBankPassbook,
  registerCustomer,
} = require("../controllers/customer.controller.js");

const authMiddleware = require("../middleware/auth.middleware.js");
const { uploadImage } = require("../middleware/upload.middleware.js");
const validateRequest = require("../middleware/validateRequest.js");
const {
  sendCustomerOtpSchema,
  verifyCustomerOtpSchema,
  aadhaarKycSchema,
  panKycSchema,
  bankPassbookSchema,
  updateCustomerSchema,
} = require("../validations/customerValidation.js");

const router = express.Router();

router.use(authMiddleware);
router.post(
  "/send-otp",
  validateRequest(sendCustomerOtpSchema),
  sendCustomerOtp,
);
router.post("/register", registerCustomer);
router.post(
  "/verify-and-create",
  validateRequest(verifyCustomerOtpSchema),
  verifyOtpAndCreateCustomer,
);

router.get("/", getAllCustomers);
router.get("/:id", getCustomerById);
router.put(
  "/:id",
  uploadImage.single("profileUrl"),
  validateRequest(updateCustomerSchema),
  updateCustomer,
);
router.delete("/:id", deleteCustomer);

router.put(
  "/:id/kyc/aadhaar",
  validateRequest(aadhaarKycSchema),
  uploadImage.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
  ]),
  completeAadhaarKYC,
);

router.put(
  "/:id/kyc/pan",
  validateRequest(panKycSchema),
  uploadImage.single("panPhoto"),
  completePanKYC,
);

router.put(
  "/:id/kyc/bankpassbook",
  validateRequest(bankPassbookSchema),
  uploadImage.single("bankPassbookPhoto"),
  addBankPassbook,
);

module.exports = router;
