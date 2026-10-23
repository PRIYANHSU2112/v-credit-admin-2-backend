const Feedback = require("../models/Feedback.model.js");

const createFeedback = async (req, res) => {
  try {
    const { feedback } = req.body;
    const userId = req.userId;

    if (!feedback) {
      return res
        .status(400)
        .json({ success: false, message: "Feedback is required" });
    }

    const newFeedback = await Feedback.create({ userId, feedback });
    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: newFeedback,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error submitting feedback",
      error: error.message,
    });
  }
};

const getUserFeedbacks = async (req, res) => {
  try {
    const { userId } = req.params;
    const feedbacks = await Feedback.find({ userId }).sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ success: true, message: "Feedbacks retrieved", data: feedbacks });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving feedbacks",
      error: error.message,
    });
  }
};

const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate("userId", "name email");
    return res.status(200).json({
      success: true,
      message: "All feedbacks retrieved",
      data: feedbacks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving feedbacks",
      error: error.message,
    });
  }
};

const getFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id).populate(
      "userId",
      "name email"
    );

    if (!feedback) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Feedback retrieved", data: feedback });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving feedback",
      error: error.message,
    });
  }
};

module.exports = {
  createFeedback,
  getUserFeedbacks,
  getAllFeedbacks,
  getFeedbackById,
};
