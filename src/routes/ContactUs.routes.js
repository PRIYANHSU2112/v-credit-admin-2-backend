const express = require("express");
const router = express.Router();

const {
  createContactUs,
  getAllContactUs,
  getContactUsByCustomerId,
} = require("../controllers/ContactUs.controller");

const authMiddleware = require("../middleware/auth.middleware");
const validateRequest = require("../middleware/validateRequest");
const { createContactUsSchema } = require("../validations/contactUsValidation");

router.post("/create", validateRequest(createContactUsSchema), createContactUs);
router.get("/all", getAllContactUs);
router.get("/:customerId", getContactUsByCustomerId);

module.exports = router;
