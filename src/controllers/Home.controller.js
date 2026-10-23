const mongoose = require("mongoose");
const Loan = require("../models/CustomerLoan.model");
const User = require("../models/UserModel");
const Customer = require("../models/Customer.model");

exports.homeInfo = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    // If user is a customer (role 'user' or has no specific role defined, usually 'user')
    // We want to show their specific loan details.
    // A dealer/admin who logs in through the "Customer Login" (OTP) flow carries a
    // loginMode="customer" claim so they still see their own loan dashboard.
    // Older tokens (before loginMode existed) send X-App-Context: customer from the app.
    const appContext = String(req.headers["x-app-context"] || "").toLowerCase();
    const isCustomerView =
      user &&
      (user.role === "user" ||
        req.loginMode === "customer" ||
        (appContext === "customer" && req.loginMode !== "dealer"));
    if (isCustomerView) {
      // Match on the last 10 digits so stored formats like "+917050234325",
      // "917050234325" or "7050234325" all resolve to the same customer.
      const normalizedPhone = String(user.phone || "")
        .replace(/\D/g, "")
        .slice(-10);

      let customer = null;
      if (normalizedPhone.length === 10) {
        customer = await Customer.findOne({
          customerMobileNumber: { $regex: `${normalizedPhone}$` },
        });
      }
      if (!customer) {
        customer = await Customer.findOne({
          customerMobileNumber: user.phone,
        });
      }

      if (!customer) {
        return res.status(200).json({
          success: true,
          data: { message: "No customer profile found" },
        });
      }

      // Find loan for this customer (prioritize active/approved, fallback to latest closed/any)
      let loan = await Loan.findOne({
        customerId: customer._id,
        loanStatus: { $in: ["APPROVED", "ACTIVE"] },
      }).sort({ createdAt: -1 });

      if (!loan) {
        loan = await Loan.findOne({
          customerId: customer._id,
        }).sort({ createdAt: -1 });
      }

      if (!loan) {
        return res
          .status(200)
          .json({ success: true, data: { message: "No loan found" } });
      }

      // Full outstanding (for early / pre-payment / foreclosure): sum of every
      // installment that is not fully paid (principal remaining + accrued fees).
      let outstandingAmount = 0;
      let totalInstallments = 0;
      let paidInstallments = 0;
      if (Array.isArray(loan.installments)) {
        totalInstallments = loan.installments.length;
        loan.installments.forEach((inst) => {
          if (inst.status === "PAID") {
            paidInstallments += 1;
          } else {
            outstandingAmount +=
              (inst.amount || 0) +
              (inst.lateFee || 0) +
              (inst.bounceFee || 0) -
              (inst.paidAmount || 0);
          }
        });
      }
      if (outstandingAmount <= 0) {
        outstandingAmount = Math.max(0, Number(loan.amountLeft || 0));
      }

      // Construct response for dashboard
      const dashboardData = {
        isCustomer: true,
        nextDueDate: loan.nextDueDate || "N/A", // You might need to calculate next due date from installments
        amount: loan.emiAmount || 0,
        lateFee: 0,
        bounceFee: 0,
        status: loan.deviceUnlockStatus || loan.loanStatus,
        customerName: customer.customerName,
        loanId: loan._id,
        outstandingAmount: Math.round(outstandingAmount),
        totalInstallments,
        paidInstallments,
        nextInstallmentId: null,
        nextInstallmentDue: 0,
      };

      // Pick the earliest not-yet-paid installment (by due date). This is the one
      // a customer would pay next — even proactively, BEFORE it is due / device
      // locks. Exposing its id lets the app charge exactly that installment.
      if (loan.installments && loan.installments.length > 0) {
        const unpaid = loan.installments
          .filter((i) => i.status !== "PAID")
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const pendingInstallment = unpaid[0];
        if (pendingInstallment) {
          const instDue =
            (pendingInstallment.amount || 0) +
            (pendingInstallment.lateFee || 0) +
            (pendingInstallment.bounceFee || 0) -
            (pendingInstallment.paidAmount || 0);
          dashboardData.nextInstallmentId = pendingInstallment._id;
          dashboardData.nextInstallmentDue = Math.round(Math.max(0, instDue));
          dashboardData.nextDueDate = pendingInstallment.dueDate;
          dashboardData.amount = pendingInstallment.amount;
          dashboardData.lateFee = pendingInstallment.lateFee || 0;
          dashboardData.bounceFee = pendingInstallment.bounceFee || 0;
          dashboardData.status =
            pendingInstallment.status === "OVERDUE"
              ? "Overdue"
              : loan.deviceUnlockStatus;
        }
      }

      const isFullyPaid =
        loan.loanStatus === "CLOSED" ||
        (totalInstallments > 0 && paidInstallments >= totalInstallments) ||
        (outstandingAmount <= 0 && (loan.amountLeft || 0) <= 0);

      // Dynamic Notification Logic
      let notificationMsg = "Welcome to Vlocker! No new notifications.";
      if (isFullyPaid) {
        dashboardData.status = "Paid";
        dashboardData.nextDueDate = "N/A";
        dashboardData.outstandingAmount = 0;
        dashboardData.nextInstallmentId = null;
        dashboardData.nextInstallmentDue = 0;
        notificationMsg =
          "Aapka loan poora chuka diya gaya hai. Dhanyavaad!";
      } else if (dashboardData.status === "LOCKED") {
        notificationMsg =
          "Your device is LOCKED due to overdue payment. Please pay immediately.";
      } else if (dashboardData.status === "Overdue") {
        notificationMsg =
          "Your payment is overdue. Please pay immediately to avoid service interruption.";
      } else if (
        dashboardData.status === "APPROVED" ||
        dashboardData.status === "ACTIVE" ||
        dashboardData.status === "UNLOCKED"
      ) {
        notificationMsg = "Your loan is active. Please pay your EMI on time.";
      }

      dashboardData.notification = notificationMsg;

      return res.status(200).json({ success: true, data: dashboardData });
    }

    // Only Super Admin sees global stats; dealers/shop admins see only their own.
    const ownerFilter = req.isSuperAdmin
      ? {}
      : { createdBy: new mongoose.Types.ObjectId(userId) };

    const query = Loan.aggregate([
      {
        $match: {
          ...ownerFilter,
          deviceUnlockStatus: "LOCKED",
        },
      },
      {
        $count: "totalLockedDevices",
      },
    ]);
    const query2 = Loan.aggregate([
      {
        $match: {
          ...ownerFilter,
          loanStatus: "CLOSED",
        },
      },
      {
        $count: "totalDeactivatedDevice",
      },
    ]);
    const query3 = Loan.aggregate([
      {
        $match: {
          ...ownerFilter,
          loanStatus: "PENDING",
        },
      },

      {
        $count: "totalNotActiveDevices",
      },
    ]);
    const query4 = Loan.aggregate([
      {
        $match: {
          ...ownerFilter,
        },
      },
      {
        $count: "totalEnrolledDevices",
      },
    ]);
    const [lockedDevices, deactivateDevice, notActiveDevice, enrolledDevice] =
      await Promise.all([query.exec(), query2, query3, query4]);

    const total = {
      totalLockedDevices: lockedDevices[0]?.totalLockedDevices || 0,
      totalEnrolledDevices: enrolledDevice[0]?.totalEnrolledDevices || 0,
      totalDeactivatedDevices: deactivateDevice[0]?.totalDeactivatedDevice || 0,
      totalNotActiveDevices: notActiveDevice[0]?.totalNotActiveDevices || 0,
    };

    res.status(200).json({ success: true, data: total });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "failed to fetch data",
      error: error.message,
    });
  }
};

exports.adminHomeInfo = async (req, res) => {
  try {
    // Global network stats are Super Admin only.
    if (!req.isSuperAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden" });
    }
    const { year } = req.query;
    const query = Loan.aggregate([
      {
        $match: {
          deviceUnlockStatus: "LOCKED",
        },
      },
      {
        $count: "totalLockedDevices",
      },
    ]);
    const query2 = Loan.aggregate([
      {
        $match: {
          loanStatus: "CLOSED",
        },
      },
      {
        $count: "totalDeactivatedDevice",
      },
    ]);
    const query3 = Loan.aggregate([
      {
        $match: {
          loanStatus: "PENDING",
        },
      },

      {
        $count: "totalPendingLoans",
      },
    ]);
    const query4 = Loan.aggregate([
      {
        $count: "totalEnrolledDevices",
      },
    ]);
    const query5 = User.countDocuments({});
    const query6 = User.countDocuments({
      isDisabled: false,
    });
    const query7 = User.countDocuments({
      isDisabled: true,
    });
    const query8 = Loan.aggregate([
      {
        $match: {
          loanStatus: "APPROVED",
        },
      },
      {
        $count: "totalApprovedLoans",
      },
    ]);
    const query9 = Loan.aggregate([
      {
        $match: {
          loanStatus: "REJECTED",
        },
      },
      {
        $count: "totalRejectedLoans",
      },
    ]);
    let query10 = null;
    if (year) {
      const yearInt = parseInt(year);
      const startDate = new Date(yearInt, 0, 1);
      const endDate = new Date(yearInt + 1, 0, 1);

      query10 = User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);
    }

    const queries = [
      query.exec(),
      query2,
      query3,
      query4,
      query5,
      query6,
      query7,
      query8,
      query9,
    ];

    if (query10) {
      queries.push(query10);
    }

    const results = await Promise.all(queries);

    const [
      lockedDevicess,
      deactivateDevices,
      pendingDevices,
      allDevices,
      totalUsers,
      totalActiveUsers,
      totalDisabledUsers,
      totalApprovedLoans,
      totalRejectedLoans,
      monthlyUsers,
    ] = results;

    const total = {
      totalLockedDevices: lockedDevicess[0]?.totalLockedDevices || 0,
      totalEnrolledDevices: allDevices[0]?.totalEnrolledDevices || 0,
      totalDeactivatedDevices:
        deactivateDevices[0]?.totalDeactivatedDevice || 0,
      totalApprovedLoans: totalApprovedLoans[0]?.totalApprovedLoans || 0,
      totalRejectedLoans: totalRejectedLoans[0]?.totalRejectedLoans || 0,
      totalPendingLoans: pendingDevices[0]?.totalPendingLoans || 0,
      totalUsers: totalUsers,
      totalActiveUsers: totalActiveUsers,
      totalDisabledUsers: totalDisabledUsers,
    };

    if (year && monthlyUsers) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthlyData = monthNames.map((name, index) => 0);

      monthlyUsers.forEach((item) => {
        monthlyData[item._id - 1] = item.count;
      });

      total.monthlyUserRegistrations = monthlyData;
    }

    res.status(200).json({ success: true, data: total });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "failed to fetch data",
      error: error.message,
    });
  }
};
