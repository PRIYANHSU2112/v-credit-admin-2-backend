const EnterpriseKey = require("../../models/EnterpriseKey.model");
const User = require("../../models/UserModel");
const Loan = require("../../models/CustomerLoan.model");
const { resolveHierarchy } = require("../../services/mobile/hierarchy.helper");
const {
  resolveCustomerForUser,
} = require("../../services/mobile/activation.service");

/**
 * STEP 3: after login, return everything the app needs to bootstrap:
 * customer profile, assigned/active key, dealer info and organization info.
 */
const bootstrap = async (req, res) => {
  try {
    const user = req.mobileUser;
    const customer = await resolveCustomerForUser(user);

    let key = null;
    let loan = null;
    let dealer = null;
    let organization = null;

    if (customer) {
      key = await EnterpriseKey.findOne({
        assignedToCustomerId: customer._id,
        status: { $in: ["Assigned", "Activated", "Running", "Expired"] },
        isDeleted: false,
      }).sort({ assignedAt: -1 });

      loan = await Loan.findOne({ customerId: customer._id }).sort({
        createdAt: -1,
      });
    }

    const dealerId = key?.dealerId || customer?.createdBy;
    if (dealerId) {
      dealer = await User.findById(dealerId).select(
        "name phone city territory entityCode enterpriseRole",
      );
      const hierarchy = await resolveHierarchy(dealerId);
      if (hierarchy.stockistId) {
        organization = await User.findById(hierarchy.stockistId).select(
          "name city territory entityCode",
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          userId: user._id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          isProfileCompleted: user.isProfileCompleted,
        },
        customer: customer
          ? {
              customerId: customer._id,
              customerName: customer.customerName,
              customerMobileNumber: customer.customerMobileNumber,
              address: customer.address,
              isVerified: customer.isVerified,
            }
          : null,
        key: key
          ? {
              keyNumber: key.keyNumber,
              status: key.status,
              activationDate: key.activationDate,
              expiryDate: key.expiryDate,
              deviceId: key.deviceId,
              imei: key.imei,
            }
          : null,
        loan: loan
          ? {
              loanId: loan._id,
              loanStatus: loan.loanStatus,
              emiAmount: loan.emiAmount,
              amountLeft: loan.amountLeft,
            }
          : null,
        dealer,
        organization,
      },
    });
  } catch (error) {
    console.error("Bootstrap error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

module.exports = { bootstrap };
