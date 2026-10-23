const express = require("express");
const {
  createFeedback,
  getUserFeedbacks,
  getAllFeedbacks,
  getFeedbackById,
} = require("../controllers/Feedback.controller.js");
const authMiddleware = require("../middleware/auth.middleware.js");

const router = express.Router();

router.post("/", authMiddleware, createFeedback);

router.get("/:userId", authMiddleware, getUserFeedbacks);

router.get("/", authMiddleware, getAllFeedbacks);

router.get("/:id", authMiddleware, getFeedbackById);

module.exports = router;
