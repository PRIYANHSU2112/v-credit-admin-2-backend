const express = require("express");
const {
  createAddress,
  getAddressesForCustomer,
  getAddressById,
  updateAddress,
  deleteAddress,
} = require("../controllers/CustomerAddress.controller");
const authMiddleware = require("../middleware/auth.middleware");
const validateRequest = require("../middleware/validateRequest");
const {
  createAddressSchema,
  updateAddressSchema,
  paramIdSchema,
} = require("../validations/addressValidation");

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

router.post(
  "/:customerId",

  validateRequest(createAddressSchema, "body"),
  createAddress
);

router.get("/", getAddressesForCustomer);

router.get(
  "/:customerId",

  getAddressById
);

router.put(
  "/:customerId",

  validateRequest(updateAddressSchema, "body"),
  updateAddress
);

router.delete(
  "/:addressId",

  deleteAddress
);

module.exports = router;
