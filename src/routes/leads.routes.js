const express = require("express");
const router = express.Router();
const LeadForm = require("../models/LeadForm.model");
const authMiddleware = require("../middleware/auth.middleware");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leads  (PUBLIC — no auth required, called from VLockerReferralApp)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { fullName, mobile, city, mobileBrand, mobileModel, aadhaarNumber, panNumber } = req.body;

    if (!fullName || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Full name and mobile number are required.",
      });
    }

    if (mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be exactly 10 digits.",
      });
    }

    const lead = await LeadForm.create({
      fullName,
      mobile,
      city,
      mobileBrand,
      mobileModel,
      aadhaarNumber,
      panNumber,
      source: "VLockerReferralApp",
    });

    return res.status(201).json({
      success: true,
      message: "Lead submitted successfully. Download VLocker to get started!",
      data: { id: lead._id },
    });
  } catch (error) {
    console.error("POST /api/leads Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leads  (PROTECTED — admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await LeadForm.countDocuments(query);
    const leads = await LeadForm.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("GET /api/leads Error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/leads/:id  (PROTECTED — update lead status/notes)
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const lead = await LeadForm.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    );
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }
    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error("PATCH /api/leads/:id Error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
