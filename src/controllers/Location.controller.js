const Loan = require("../models/CustomerLoan.model");

exports.updateLocation = async (req, res) => {
  try {
    const { loanId, latitude, longitude } = req.body;

    if (!loanId || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Loan ID, Latitude, and Longitude are required.",
      });
    }

    const updatedLoan = await Loan.findByIdAndUpdate(
      loanId,
      {
        location: {
          latitude,
          longitude,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updatedLoan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: updatedLoan.location,
    });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating location",
      error: error.message,
    });
  }
};
