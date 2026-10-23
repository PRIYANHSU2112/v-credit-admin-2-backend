const express = require("express");
const router = express.Router();
const razorpayController = require("../controllers/Razorpay.controller");

router.post("/create-order", razorpayController.createOrder);
router.post("/verify-payment", razorpayController.verifyPayment);

module.exports = router;
