const express = require("express");
const {
  addBank,
  getBanksByCustomer,
  getBankById,
  updateBank,
  deleteBank,
} = require("../controllers/CustomerBank.controller");

const authMiddleware = require("../middleware/auth.middleware");
const validateRequest = require("../middleware/validateRequest");
const {
  paramIdSchema,
  addBankSchema,
  updateBankSchema,
} = require("../validations/customerbankValidation");

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.post(
  "/",

  validateRequest(addBankSchema, "body"),
  addBank
);

router.get(
  "/",

  getBanksByCustomer
);

router.get(
  "/single/:bankId",

  getBankById
);

router.put(
  "/:bankId",

  validateRequest(updateBankSchema, "body"),
  updateBank
);

router.delete("/:bankId", deleteBank);

module.exports = router;
