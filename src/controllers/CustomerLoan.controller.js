const Loan = require("../models/CustomerLoan.model");
const Customer = require("../models/Customer.model");
const User = require("../models/UserModel");
const mongoose = require("mongoose");
const {
  calculateTotalInstallmentDue,
  isLoanCleared,
  settleClearedLoan,
} = require("../utils/overdueUtils");

const getMyLoans = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Normalize phone to search for customer
    const searchPhone = user.phone.replace(/\D/g, "").slice(-10);
    const customer = await Customer.findOne({
      customerMobileNumber: { $regex: `${searchPhone}$` },
    });

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer profile not found" });
    }

    const loans = await Loan.find({ customerId: customer._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      message: "My loans fetched successfully",
      data: loans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching my loans",
      error: error.message,
    });
  }
};

const generateInstallments = ({
  numberOfEMIs,
  emiAmount,
  firstEmiDate,
  frequency,
}) => {
  const installments = [];
  let currentDate = new Date(firstEmiDate);

  for (let i = 1; i <= numberOfEMIs; i++) {
    installments.push({
      installmentNumber: i,
      dueDate: new Date(currentDate),
      amount: emiAmount,
      status: emiAmount == 0 ? "PAID" : "PENDING",
      paidAmount: 0,
      paidDate: emiAmount == 0 ? new Date() : null,
      paymentMethod: null,
      lateFee: 0,
      remarks: null,
    });

    if (frequency === "monthly" && i < numberOfEMIs) {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (frequency === "weekly" && i < numberOfEMIs) {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (frequency === "daily" && i < numberOfEMIs) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return [installments, currentDate];
};
const calculateEMI = (principal, annualRate, numberOfEMIs) => {
  const monthlyRate = annualRate / 12 / 100;

  if (monthlyRate === 0) {
    return Math.round(principal / numberOfEMIs);
  }

  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfEMIs)) /
    (Math.pow(1 + monthlyRate, numberOfEMIs) - 1);

  return Math.round(emi);
};

const createCustomerloan = async (req, res) => {
  const { customerId } = req.params;
  try {
    const customer = await Customer.findOne({
      _id: customerId,
      createdBy: req.userId,
    });

    const keysExist = await User.findById(req.userId);
    const loanExist = await Loan.findOne({
      imeiNumber1: req.body.imeiNumber1,
    });
    if (loanExist) {
      return res.status(400).json({
        success: false,
        message: "imei number already exist",
      });
    }

    if (keysExist?.keys <= 0) {
      return res.status(400).json({
        success: false,
        message: "request keys to create loan",
      });
    }
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you are not authorized",
      });
    }
    const downPayment = req.body?.downPayment || 0;
    const mobilePrice = req.body?.mobilePrice || 0;
    const processingFees = req.body?.processingFees || 0;
    const interestRate = req.body?.interestRate || 0;
    const numberOfEMIs = req.body?.numberOfEMIs || 1;
    const financer = req.body?.financer || "admin";
    const paymentOptions = req.body?.paymentOptions || "upi";

    let firstEmiDate = new Date(req.body?.firstEmiDate);
    if (isNaN(firstEmiDate)) {
      firstEmiDate = new Date();
    }

    const loanAmount = req.body?.loanAmount;
    const amountLeft = loanAmount;
    let frequency = req.body?.frequency || "monthly";

    const emiAmount = calculateEMI(loanAmount, interestRate, numberOfEMIs);
    console.log(req.body, emiAmount);
    console.log(loanAmount, interestRate, numberOfEMIs, emiAmount);
    const [installments, emiEndDate] = generateInstallments({
      numberOfEMIs,
      emiAmount,
      firstEmiDate,
      frequency,
    });

    const loan = new Loan({
      ...req.body,
      installments,
      financer,
      paymentOptions,
      emiAmount,
      amountLeft: amountLeft,
      amountPaid: downPayment,
      emiStartDate: firstEmiDate,
      emiEndDate: emiEndDate,
      customerId: customerId,
      createdBy: req.userId,
    });
    await loan.save();

    // 1 loan = 1 license key: reserve an available EnterpriseKey for this
    // customer (status → "Assigned"), stamping the dealer hierarchy + device IMEI.
    // The device later activates this key from the mobile app.
    let assignedKey = null;
    try {
      const { assignKeyForLoan } = require("../services/mobile/activation.service");
      assignedKey = await assignKeyForLoan({
        loanId: loan._id,
        customerId,
        dealerUserId: req.userId,
        imei: req.body.imeiNumber1,
        performedBy: req.userId,
      });
    } catch (assignErr) {
      // Do not fail loan creation if key reservation has an issue; log for follow-up.
      console.error("Key assignment on loan failed:", assignErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Customer Loan created successfully",
      data: loan,
      assignedKey: assignedKey
        ? { keyNumber: assignedKey.keyNumber, status: assignedKey.status }
        : null,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A loan with this IMEI number already exists.",
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: "Error creating customer Loan",
      error: error.message,
    });
  }
};

const getAllCustomersloan = async (req, res) => {
  try {
    console.log("Fetching loans for customerId:", req.params.customerId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      customerId: new mongoose.Types.ObjectId(req.params.customerId),
      // Only Super Admin sees everything; dealers/shop admins see only their own.
      ...(!req.isSuperAdmin && {
        createdBy: new mongoose.Types.ObjectId(req.userId),
      }),
    };

    // const loans2 = await Loan.find(filter)
    //   .skip(skip)
    //   .limit(limit)
    //   .sort({ createdAt: -1 }).populate("customerId");

    let sort = undefined;
    if (!sort) {
      sort = {
        createdAt: -1,
      };
    }

    const loans = await Loan.aggregate([
      { $match: filter },

      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customerId",
        },
      },
      { $unwind: "$customerId" },
      {
        $addFields: {
          installmentsPaid: {
            $size: {
              $filter: {
                input: { $ifNull: ["$installments", []] },
                as: "inst",
                cond: { $eq: ["$$inst.status", "PAID"] },
              },
            },
          },
          nextEmiDetails: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$installments", []] },
                  as: "inst",
                  cond: { $eq: ["$$inst.status", "PENDING"] },
                },
              },
              0,
            ],
          },
          totalDueAmount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$installments", []] },
                    as: "inst",
                    cond: {
                      $and: [
                        { $eq: ["$$inst.status", "PENDING"] },
                        { $lte: ["$$inst.dueDate", new Date()] },
                      ],
                    },
                  },
                },
                as: "dueInst",
                in: "$$dueInst.amount",
              },
            },
          },
        },
      },
      {
        $facet: {
          data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);
    const totalLoans = loans[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLoans / limit);

    const pagination = {
      totalLoans,
      totalPages: totalPages,
      currentPage: page,
    };

    res.status(200).json({
      success: true,
      message: "Customers Loan retrieved successfully",
      data: loans[0]?.data,
      pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving customers Loan",
      error: error.message,
    });
  }
};
const getAllloans = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const runningDevice = req.query.runningDevice || null;
    const newDevice = req.query.newDevice || null;
    const deactivateDevices = req.query?.deactivateDevices || null;
    const lockedDevices = req.query?.lockedDevices || null;
    const notActiveDevices = req.query?.notActiveDevices || null;
    const upcomingEmis = req.query?.upcomingEmis || null;
    const unlockDevices = req.query.unlockDevices || null;
    let sort = undefined;

    const filters = [];

    if (runningDevice) {
      filters.push({
        loanStatus: "APPROVED",
        firstEmiDate: { $lte: new Date() },
      });
    }
    if (newDevice) {
      filters.push({
        loanStatus: "APPROVED",
        firstEmiDate: { $gte: new Date() },
      });
    }
    if (deactivateDevices) {
      filters.push({
        loanStatus: "CLOSED",
      });
    }
    if (lockedDevices) {
      filters.push({
        deviceUnlockStatus: "LOCKED",
      });
    }
    if (unlockDevices) {
      filters.push({
        deviceUnlockStatus: "UNLOCKED",
        loanStatus: "APPROVED",
      });
    }
    if (notActiveDevices) {
      filters.push({
        loanStatus: "PENDING",
      });
    }
    if (upcomingEmis) {
      filters.push({
        loanStatus: "APPROVED",
        installments: {
          $elemMatch: {
            dueDate: { $gte: new Date() },
            status: "PENDING",
          },
        },
      });
      sort = {
        "installments.dueDate": 1,
      };
    }
    const finalFilter = {
      // Only Super Admin sees everything; dealers/shop admins see only their own.
      ...(!req.isSuperAdmin && {
        createdBy: new mongoose.Types.ObjectId(req.userId),
      }),
      ...(req.isSuperAdmin && req.query.dealerId && {
        createdBy: new mongoose.Types.ObjectId(req.query.dealerId),
      }),
      ...(filters.length > 0 ? { $or: filters } : {}),
    };

    if (!sort) {
      sort = {
        createdAt: -1,
      };
    }

    const loans = await Loan.aggregate([
      { $match: finalFilter },

      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customerId",
        },
      },
      {
        $unwind: {
          path: "$customerId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "dealer",
        },
      },
      {
        $unwind: {
          path: "$dealer",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Search Filter
      ...(req.query.search
        ? [
            {
              $match: {
                $or: [
                  {
                    "customerId.customerName": {
                      $regex: req.query.search,
                      $options: "i",
                    },
                  },
                  {
                    "customerId.customerMobileNumber": {
                      $regex: req.query.search,
                      $options: "i",
                    },
                  },
                  {
                    "dealer.name": {
                      $regex: req.query.search,
                      $options: "i",
                    },
                  },
                  {
                    mobileBrand: { $regex: req.query.search, $options: "i" },
                  },
                  {
                    mobileModel: { $regex: req.query.search, $options: "i" },
                  },
                  {
                    imeiNumber1: { $regex: req.query.search, $options: "i" },
                  },
                ],
              },
            },
          ]
        : []),
      {
        $addFields: {
          installmentsPaid: {
            $size: {
              $filter: {
                input: { $ifNull: ["$installments", []] },
                as: "inst",
                cond: { $eq: ["$$inst.status", "PAID"] },
              },
            },
          },
          nextEmiDetails: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$installments", []] },
                  as: "inst",
                  cond: { $eq: ["$$inst.status", "PENDING"] },
                },
              },
              0,
            ],
          },
          totalDueAmount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$installments", []] },
                    as: "inst",
                    cond: {
                      $and: [
                        { $eq: ["$$inst.status", "PENDING"] },
                        { $lte: ["$$inst.dueDate", new Date()] },
                      ],
                    },
                  },
                },
                as: "dueInst",
                in: "$$dueInst.amount",
              },
            },
          },
        },
      },
      {
        $facet: {
          data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);
    //  console.log(loans)

    // const totalLoans = await Loan.countDocuments();

    // const totalPages = Math.ceil(totalLoans / limit);
    const totalLoans = loans[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLoans / limit);

    const pagination = {
      totalLoans: totalLoans,
      totalPages: totalPages,
      currentPage: page,
    };

    res.status(200).json({
      success: true,
      message: "Customers Loan retrieved successfully",
      data: loans[0]?.data,
      pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving customers Loan",
      error: error.message,
    });
  }
};

const getCustomerloanById = async (req, res) => {
  try {
    console.log("Fetching loan with ID:", req.params.loanId, req.userId);
    const query = { _id: req.params.loanId };

    const user = await User.findById(req.userId);
    let customer = null;
    if (user?.phone) {
      const searchPhone = user.phone.replace(/\D/g, "").slice(-10);
      customer = await Customer.findOne({
        customerMobileNumber: { $regex: `${searchPhone}$` },
      });
    }

    // Check if role is 'user' (default for customers) or 'customer' (legacy/explicit) or customer login mode
    if (req.role === "user" || req.role === "customer" || req.loginMode === "customer") {
      if (customer) {
        query.customerId = customer._id;
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Customer profile not found" });
      }
    } else if (!req.isSuperAdmin) {
      // For shop owners / dealers, allow if created by them OR if they are the customer
      if (customer) {
        query.$or = [{ createdBy: req.userId }, { customerId: customer._id }];
      } else {
        query.createdBy = req.userId;
      }
    }

    const loan = await Loan.findOne(query)
      .populate("customerId")
      .populate("createdBy", "name email phone agencyName");
    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }
    res.status(200).json({ success: true, message: "Loan found", data: loan });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding customer Loan",
      error: error.message,
    });
  }
};

const recordFullPayment = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { installmentNumber, amount, paymentMethod, transactionRef, remarks } = req.body;

    const query = { _id: loanId };
    if (!req.isSuperAdmin) {
      query.createdBy = req.userId;
    }

    const loan = await Loan.findOne(query)
      .populate("customerId")
      .populate("createdBy", "name email phone agencyName");

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Customer loan not found or you are not authorized to record payment",
      });
    }

    // Identify target installment
    let targetInst = null;
    if (installmentNumber !== undefined && installmentNumber !== null) {
      targetInst = (loan.installments || []).find(
        (i) => i.installmentNumber === Number(installmentNumber)
      );
    } else {
      // Find earliest unpaid or overdue installment
      const sortedUnpaid = [...(loan.installments || [])]
        .filter((i) => i.status !== "PAID")
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      targetInst = sortedUnpaid[0];
    }

    if (!targetInst) {
      return res.status(400).json({
        success: false,
        message: "No pending installments found for this loan. All installments are already paid.",
      });
    }

    // Strict No Partial Payment Enforcement:
    const fullInstallmentDue = (targetInst.amount || 0) + (targetInst.lateFee || 0) + (targetInst.bounceFee || 0) - (targetInst.paidAmount || 0);
    const paidAmount = Number(amount) || fullInstallmentDue;

    if (paidAmount < fullInstallmentDue) {
      return res.status(400).json({
        success: false,
        message: `Partial EMI payments are strictly disabled. The full installment amount of ₹${fullInstallmentDue} must be paid in full.`,
      });
    }

    // Update target installment
    targetInst.status = "PAID";
    targetInst.paidAmount = (targetInst.paidAmount || 0) + paidAmount;
    targetInst.paidDate = new Date();
    targetInst.paymentMethod = paymentMethod || "cash";
    targetInst.lateFee = 0;
    targetInst.bounceFee = 0;
    if (remarks) targetInst.remarks = remarks;

    // Recalculate loan aggregates
    loan.amountPaid = (loan.amountPaid || 0) + paidAmount;
    loan.amountLeft = Math.max(0, (loan.amountLeft || 0) - (targetInst.amount || 0));
    loan.installmentsPaid = (loan.installments || []).filter((i) => i.status === "PAID").length;

    // Check if any overdue installments remain; if none, auto unlock device
    const now = new Date();
    const remainingOverdues = (loan.installments || []).filter(
      (i) => i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < now)
    );
    if (remainingOverdues.length === 0 && loan.deviceUnlockStatus === "LOCKED") {
      loan.deviceUnlockStatus = "UNLOCKED";
    }

    // Auto-close loan if all installments are paid
    settleClearedLoan(loan);

    await loan.save();

    const receipt = {
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      loanId: loan._id,
      loanNumber: loan.imeiNumber1 ? `LN-${loan.imeiNumber1.slice(-6)}` : `LN-${loan._id.toString().slice(-6).toUpperCase()}`,
      customerName: loan.customerId?.customerName || "Customer",
      customerPhone: loan.customerId?.customerMobileNumber || "",
      dealerName: loan.createdBy?.name || loan.shopName || "Authorized Dealer",
      installmentNumber: targetInst.installmentNumber,
      amountPaid: paidAmount,
      principalPaid: targetInst.amount || 0,
      paymentMethod: targetInst.paymentMethod,
      transactionRef: transactionRef || `TXN-${Date.now().toString().slice(-8)}`,
      paidDate: targetInst.paidDate,
      remainingBalance: loan.amountLeft,
      deviceUnlockStatus: loan.deviceUnlockStatus,
      status: targetInst.status,
    };

    return res.status(200).json({
      success: true,
      message: `Installment #${targetInst.installmentNumber} payment of ₹${paidAmount} recorded successfully`,
      data: loan,
      receipt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error recording full payment",
      error: error.message,
    });
  }
};

const updateCustomerloan = async (req, res) => {
  try {
    const query = { _id: req.params.loanId };
    if (!req.isSuperAdmin) {
      query.createdBy = req.userId;
    }

    // Check if status is being changed to APPROVED
    const isApproving = req.body.loanStatus === "APPROVED";

    const loan = await Loan.findOneAndUpdate(
      query,
      { $set: req.body },
      { new: true, runValidators: true },
    ).populate("customerId");

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Customer loan not found or you are not authorized to update",
      });
    }

    // Auto-close loan if all installments are paid or status set to CLOSED
    const allInstPaid =
      loan.installments &&
      loan.installments.length > 0 &&
      loan.installments.every((inst) => inst.status === "PAID");

    if (allInstPaid || loan.loanStatus === "CLOSED") {
      loan.loanStatus = "CLOSED";
      loan.deviceUnlockStatus = "UNLOCKED";
      loan.amountLeft = 0;
      if (loan.installments) {
        loan.installmentsPaid = loan.installments.length;
      }
      await loan.save();
    }

    if (isApproving && loan.customerId) {
      // Send notification to user
      try {
        const customer = loan.customerId;
        // Normalize phone: remove all non-digits
        const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");

        let user = await User.findOne({ phone: customer.customerMobileNumber });
        if (!user) {
          user = await User.findOne({ phone: searchPhone });
        }

        if (user && user.pushNotificationToken) {
          console.log("Loan Approved. Sending FCM to user:", user._id);
          await sendNotificationCore({
            userId: user._id,
            title: "Loan Approved",
            body: "Your loan has been approved successfully.",
            data: { type: "LOAN_UPDATE" },
            silent: true,
            highPriority: true,
          });
        } else {
          console.log(
            "Loan Approved but User/Token not found for notification.",
          );
        }
      } catch (notifyError) {
        console.error("Error sending loan approval notification:", notifyError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Customer loan updated successfully",
      data: loan,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating customer loan",
      error: error.message,
    });
  }
};

const deleteCustomerloan = async (req, res) => {
  try {
    const query = { _id: req.params.loanId };
    if (!req.isSuperAdmin) {
      query.createdBy = req.userId;
    }

    const loan = await Loan.findOneAndDelete(query);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Customer loan not found or you are not authorized to delete",
      });
    }
    res
      .status(200)
      .json({ success: true, message: "Customer loan deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting customer loan",
      error: error.message,
    });
  }
};

const getDueInstallments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const userId = new mongoose.Types.ObjectId(req.userId);

    const dueInstallments = await Loan.aggregate([
      {
        $match: {
          createdBy: userId,
          installments: {
            $elemMatch: {
              dueDate: { $lte: new Date() },
              status: "PENDING",
            },
          },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customerId",
        },
      },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);
    const totalLoans = dueInstallments[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLoans / limit);

    const pagination = {
      totalLoans: totalLoans,
      totalPages: totalPages,
      currentPage: page,
    };

    res.status(200).json({
      success: true,
      message: "Due installments fetched successfully",
      data: dueInstallments[0].data,
      pagination: pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting customer loan",
      error: error.message,
    });
  }
};

const { sendNotificationCore } = require("../lib/notifications");

const {
  lockDeviceCore,
  unlockDeviceCore,
} = require("../services/DeviceService");

// Helper to calculate effective app block policy based on overdue status and manual overrides
const getEffectivePolicy = (loan, totalDueAmount) => {
  const policy = loan.devicePolicy || {};
  const isPaidOrClosed =
    loan.loanStatus === "CLOSED" ||
    (loan.installments &&
      loan.installments.length > 0 &&
      loan.installments.every((inst) => inst.status === "PAID")) ||
    totalDueAmount <= 0;

  if (isPaidOrClosed) {
    return {
      isResetAllowed: true,
      isUninstallAllowed: true,
      frpAccounts: [],
      isDeveloperOptionsBlocked: false,
      isWallpaperEnabled: false,
      wallpaperUrl: "",
      isWhatsAppBlocked: false,
      isInstagramBlocked: false,
      isSnapchatBlocked: false,
      isYouTubeBlocked: false,
      isFacebookBlocked: false,
      isDialerBlocked: false,
      isMessagesBlocked: false,
      isPlayStoreBlocked: false,
      isChromeBlocked: false,
      isVoiceReminderEnabled: false,
      isLocationEnabled: false,
    };
  }

  return {
    isResetAllowed: policy.isResetAllowed ?? false,
    isUninstallAllowed: policy.isUninstallAllowed ?? false,
    // Google account id(s) that must be entered after a factory reset (FRP).
    // Per-loan override first, else a global org fallback from env.
    frpAccounts:
      Array.isArray(policy.frpAccounts) && policy.frpAccounts.length
        ? policy.frpAccounts
        : (process.env.FRP_ACCOUNTS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    isDeveloperOptionsBlocked: policy.isDeveloperOptionsBlocked ?? false,
    isWallpaperEnabled: policy.isWallpaperEnabled ?? totalDueAmount > 0,
    wallpaperUrl: policy.wallpaperUrl ?? "",
    // Smart Blocks: Use manual toggle if set, otherwise default to true if overdue
    isWhatsAppBlocked: policy.isWhatsAppBlocked ?? totalDueAmount > 0,
    isInstagramBlocked: policy.isInstagramBlocked ?? totalDueAmount > 0,
    isSnapchatBlocked: policy.isSnapchatBlocked ?? totalDueAmount > 0,
    isYouTubeBlocked: policy.isYouTubeBlocked ?? totalDueAmount > 0,
    isFacebookBlocked: policy.isFacebookBlocked ?? totalDueAmount > 0,
    isDialerBlocked: policy.isDialerBlocked ?? totalDueAmount > 0,
    isMessagesBlocked: policy.isMessagesBlocked ?? totalDueAmount > 0,
    isPlayStoreBlocked: policy.isPlayStoreBlocked ?? totalDueAmount > 0,
    isChromeBlocked: policy.isChromeBlocked ?? totalDueAmount > 0,
    isVoiceReminderEnabled: policy.isVoiceReminderEnabled ?? totalDueAmount > 0,
    isLocationEnabled: policy.isLocationEnabled ?? true,
  };
};

// Resolve a loan by its _id or IMEI and confirm the requester may control it.
// Super Admin may control any device; everyone else only devices they created.
const resolveOwnedLoan = async (identifier, req) => {
  const or = [{ imeiNumber1: identifier }, { imeiNumber2: identifier }];
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    or.unshift({ _id: identifier });
  }
  const loan = await Loan.findOne({ $or: or });
  if (!loan) return { loan: null, owned: false };
  const owned =
    req.isSuperAdmin || String(loan.createdBy) === String(req.userId);
  return { loan, owned };
};

// From a list of loan ids, return a Set of ids the requester is allowed to act on.
const filterOwnedLoanIds = async (loanIds, req) => {
  const ids = loanIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => String(id));
  if (req.isSuperAdmin) return new Set(ids);
  const owned = await Loan.find({
    _id: { $in: ids },
    createdBy: new mongoose.Types.ObjectId(req.userId),
  }).select("_id");
  return new Set(owned.map((l) => String(l._id)));
};

const lockDevice = async (req, res) => {
  try {
    const { loanId } = req.params; // Identifier (Loan ID or IMEI)
    console.log("---------------- LOCK DEVICE REQUEST ----------------");

    const { loan, owned } = await resolveOwnedLoan(loanId, req);
    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (!owned) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized for this device" });
    }

    const result = await lockDeviceCore(loanId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Lock Device Error:", error);
    if (
      error.message === "Loan not found" ||
      error.message === "Customer not found for this loan"
    ) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: "Error locking device",
      error: error.message,
    });
  }
};

const unlockDevice = async (req, res) => {
  try {
    const { loanId } = req.params; // Identifier (Loan ID or IMEI)
    console.log("---------------- UNLOCK DEVICE REQUEST ----------------");

    const { loan, owned } = await resolveOwnedLoan(loanId, req);
    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (!owned) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized for this device" });
    }

    const result = await unlockDeviceCore(loanId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Unlock Device Error:", error);
    if (
      error.message === "Loan not found" ||
      error.message === "Customer not found for this loan"
    ) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: "Error unlocking device",
      error: error.message,
    });
  }
};

const updateSimDetails = async (req, res) => {
  try {
    const { deviceId, simDetails, phone } = req.body;
    if (!deviceId && !phone) {
      return res.status(400).json({
        success: false,
        message: "deviceId or phone is required",
      });
    }

    // Find loan by IMEI or phone
    const loan = await Loan.findOne({
      $or: [
        { imeiNumber1: deviceId },
        { imeiNumber2: deviceId },
        { customerMobileNumber: phone },
      ],
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found for this device",
      });
    }

    loan.simDetails = simDetails.map((sim) => ({
      ...sim,
      timestamp: new Date(),
    }));
    loan.requestSimInfo = false;

    await loan.save();

    console.log("SIM Details updated for loan:", loan._id);

    res.status(200).json({
      success: true,
      message: "SIM Details updated successfully",
    });
  } catch (error) {
    console.error("Error updating SIM details:", error);
    res.status(500).json({
      success: false,
      message: "Error updating SIM details",
      error: error.message,
    });
  }
};

const getSimDetails = async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findById(loanId).select(
      "simDetails imeiNumber1 imeiNumber2 createdBy",
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    if (!req.isSuperAdmin && String(loan.createdBy) !== String(req.userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized for this device" });
    }

    res.status(200).json({
      success: true,
      data: loan.simDetails || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching SIM details",
      error: error.message,
    });
  }
};

const getMobileDeviceStatus = async (req, res) => {
  try {
    // 1. Identify User from Token
    const userId = req.userId;
    const { imei } = req.query; // Get IMEI from query params
    console.log("Mobile Polling Status for User:", userId, "IMEI:", imei);

    // 2. Find User's Phone Number
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 3. Find Customer with this Phone Number
    // Normalize user phone: keep last 10 digits
    const userPhone = user.phone
      ? String(user.phone).replace(/\D/g, "").slice(-10)
      : "";

    console.log("Looking for customer with phone (last 10):", userPhone);

    // Flexible search for customer
    // We want to match any customer whose mobile number ends with these 10 digits
    // Using Regex to find any customerMobileNumber that ends with userPhone
    let customer = null;
    if (userPhone) {
      customer = await Customer.findOne({
        customerMobileNumber: { $regex: `${userPhone}$` },
      });
    }

    if (!customer) {
      // Fallback: Try exact match just in case
      customer = await Customer.findOne({
        customerMobileNumber: user.phone,
      });
    }

    if (!customer) {
      // It's possible the Admin hasn't created a Customer record for this User yet
      console.log("No Customer found for mobile:", user.phone);
      return res.status(200).json({ success: true, data: null });
    }

    // 4. Find Active Loan for this Customer
    // Retrieve the latest loan
    const query = { customerId: customer._id };

    // Use IMEI to match specific device if provided
    if (imei) {
      query.$or = [{ imeiNumber1: imei }, { imeiNumber2: imei }];
    }

    const loans = await Loan.find(query).sort({
      createdAt: -1,
    });

    if (!loans || loans.length === 0) {
      console.log("No loans found for customer:", customer._id, "IMEI:", imei);
      return res.status(200).json({ success: true, data: null });
    }

    // If IMEI was provided, we naturally found the specific loan.
    // If not provided (legacy/compat), we return the latest one (or we could enforce IMEI requirement)
    // For now, defaulting to latest is safe for backward compat, but we heavily encourage sending IMEI.

    // NOTE: For the specific user request "Loan should work only for the IMEI number used while creating",
    // passing the IMEI from frontend is crucial.

    const latestLoan = loans[0];

    let totalDueAmount = 0;
    let lateFees = 0;
    let bounceFees = 0;
    let installmentPrincipalDue = 0;
    const now = new Date();

    if (latestLoan.installments && Array.isArray(latestLoan.installments)) {
      latestLoan.installments.forEach((inst) => {
        if (
          inst.status !== "PAID" &&
          (new Date(inst.dueDate) <= now ||
            inst.status === "OVERDUE" ||
            inst.status === "PARTIAL")
        ) {
          totalDueAmount += calculateTotalInstallmentDue(inst);
          lateFees += inst.lateFee || 0;
          bounceFees += inst.bounceFee || 0;
          installmentPrincipalDue +=
            (inst.amount || 0) - (inst.paidAmount || 0);
        }
      });
    }

    // Find the next upcoming due date (first PENDING installment)
    const nextDueInstallment = latestLoan.installments
      ?.filter((inst) => inst.status === "PENDING")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    const nextDueDate = nextDueInstallment ? nextDueInstallment.dueDate : null;

    console.log(
      "Found Loan:",
      latestLoan._id,
      "Status:",
      latestLoan.deviceUnlockStatus,
      "Due Amount:",
      totalDueAmount,
      "Next Due:",
      nextDueDate,
      "IMEI:",
      latestLoan.imeiNumber1,
    );

    // AUTOMATIC LOCK Logic with Grace Period and Manual Override Support
    const GRACE_PERIOD_DAYS = 0; // Immediate lock when overdue
    let effectiveStatus = "UNLOCKED";
    let lockReason = null;
    let daysOverdue = 0;

    const lastOverdueDueDate =
      latestLoan.installments && Array.isArray(latestLoan.installments)
        ? latestLoan.installments.reduce((maxDate, inst) => {
            if (
              (inst.status === "PENDING" ||
                inst.status === "OVERDUE" ||
                inst.status === "PARTIAL") &&
              new Date(inst.dueDate) <= now
            ) {
              const d = new Date(inst.dueDate);
              return d > maxDate ? d : maxDate;
            }
            return maxDate;
          }, new Date(0))
        : new Date(0);

    if (lastOverdueDueDate.getTime() > 0) {
      const timeDiff = now.getTime() - lastOverdueDueDate.getTime();
      daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    }

    const isManuallyUnlocked =
      latestLoan.deviceUnlockStatus === "UNLOCKED" &&
      latestLoan.manualUnlockTimestamp &&
      new Date(latestLoan.manualUnlockTimestamp) > lastOverdueDueDate;

    const gracePeriodExpired = daysOverdue >= GRACE_PERIOD_DAYS;

    if (isLoanCleared(latestLoan)) {
      effectiveStatus = "UNLOCKED";
      lockReason = "LOAN_CLEARED";
      daysOverdue = 0;
      totalDueAmount = 0;

      const needsSettle =
        latestLoan.loanStatus !== "CLOSED" ||
        latestLoan.deviceUnlockStatus !== "UNLOCKED";
      if (needsSettle) {
        settleClearedLoan(latestLoan);
        await latestLoan.save();
        await unlockDeviceCore(latestLoan._id).catch(() => {});
      }
    } else if (totalDueAmount > 0) {
      if (isManuallyUnlocked) {
        effectiveStatus = "UNLOCKED";
        lockReason = "MANUAL_UNLOCK_OVERRIDE";
      } else if (gracePeriodExpired) {
        effectiveStatus = "LOCKED";
        lockReason = "AUTO_LOCK_OVERDUE";
      } else {
        effectiveStatus = "UNLOCKED";
        lockReason = "GRACE_PERIOD_ACTIVE";
      }
    } else if (totalDueAmount <= 0) {
      effectiveStatus = "UNLOCKED";
      lockReason = null;
    }

    return res.status(200).json({
      success: true,
      status: effectiveStatus,
      lockReason,
      daysOverdue,
      requestLocation: latestLoan.requestLocation,
      requestSimInfo: latestLoan.requestSimInfo,
      policy: getEffectivePolicy(latestLoan, totalDueAmount),
      data: {
        ...latestLoan.toObject(),
        totalDueAmount,
        breakdown: {
          principal: installmentPrincipalDue,
          lateFees,
          bounceFees,
        },
        nextDueDate,
      },
    });
  } catch (error) {
    console.error("Mobile Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching device status",
      error: error.message,
    });
  }
};

const getDeviceStatusByImei = async (req, res) => {
  try {
    const { imei, phone } = req.query;

    if (!imei && !phone) {
      return res
        .status(400)
        .json({ success: false, message: "IMEI or Phone is required" });
    }

    let loan = null;

    // 1. Try finding by IMEI first (Most accurate for device)
    if (imei) {
      loan = await Loan.findOne({
        $or: [{ imeiNumber1: imei }, { imeiNumber2: imei }],
      }).sort({ loanStatus: 1, createdAt: -1 }); // 'APPROVED' < 'PENDING' alphabetically
    }

    // 2. Fallback to Phone only if no IMEI was provided or no loan found by IMEI
    if (!loan && phone) {
      const normalizedPhone = String(phone).replace(/\D/g, "").slice(-10);

      if (normalizedPhone.length === 10) {
        const customer = await Customer.findOne({
          customerMobileNumber: { $regex: `${normalizedPhone}$` },
        });

        if (customer) {
          loan = await Loan.findOne({
            customerId: customer._id,
          }).sort({ loanStatus: 1, updatedAt: -1 });
        }
      }
    }

    if (!loan) {
      console.log("No active loan found for identifier:", imei || phone);
      return res.status(200).json({
        success: true,
        status: "UNLOCKED",
        lockReason: "NO_ACTIVE_LOAN",
        loanCleared: true,
        nextDueDate: null,
        message: "No active loan",
      });
    }

    // Calculate total due amount
    let totalDueAmount = 0;
    let lateFees = 0;
    let bounceFees = 0;
    let installmentPrincipalDue = 0;
    const now = new Date();

    if (loan.installments && Array.isArray(loan.installments)) {
      loan.installments.forEach((inst) => {
        if (
          inst.status !== "PAID" &&
          (new Date(inst.dueDate) <= now ||
            inst.status === "OVERDUE" ||
            inst.status === "PARTIAL")
        ) {
          totalDueAmount += calculateTotalInstallmentDue(inst);
          lateFees += inst.lateFee || 0;
          bounceFees += inst.bounceFee || 0;
          installmentPrincipalDue +=
            (inst.amount || 0) - (inst.paidAmount || 0);
        }
      });
    }

    // Find the next upcoming due date
    const nextDueInstallment = loan.installments
      ?.filter((inst) => inst.status === "PENDING")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    const nextDueDate = nextDueInstallment ? nextDueInstallment.dueDate : null;

    // AUTOMATIC LOCK Logic with Grace Period and Manual Override Support
    // Grace Period: 0 days (Immediate lock)
    const GRACE_PERIOD_DAYS = 0;
    let effectiveStatus = "UNLOCKED";
    let lockReason = null;
    let daysOverdue = 0;

    const lastOverdueDueDate =
      loan.installments && Array.isArray(loan.installments)
        ? loan.installments.reduce((maxDate, inst) => {
            if (
              (inst.status === "PENDING" ||
                inst.status === "OVERDUE" ||
                inst.status === "PARTIAL") &&
              new Date(inst.dueDate) <= now
            ) {
              const d = new Date(inst.dueDate);
              return d > maxDate ? d : maxDate;
            }
            return maxDate;
          }, new Date(0))
        : new Date(0);

    // Calculate days overdue from the most recent overdue installment
    if (lastOverdueDueDate.getTime() > 0) {
      const timeDiff = now.getTime() - lastOverdueDueDate.getTime();
      daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    }

    const isManuallyUnlocked =
      loan.deviceUnlockStatus === "UNLOCKED" &&
      loan.manualUnlockTimestamp &&
      (new Date(loan.manualUnlockTimestamp) > lastOverdueDueDate ||
        new Date() - new Date(loan.manualUnlockTimestamp) < 15 * 60 * 1000); // 15 min buffer after manual unlock

    const gracePeriodExpired = daysOverdue >= GRACE_PERIOD_DAYS;

    if (isLoanCleared(loan)) {
      effectiveStatus = "UNLOCKED";
      lockReason = "LOAN_CLEARED";
      daysOverdue = 0;
      totalDueAmount = 0;

      const needsSettle =
        loan.loanStatus !== "CLOSED" || loan.deviceUnlockStatus !== "UNLOCKED";
      if (needsSettle) {
        settleClearedLoan(loan);
        await loan.save();
        await unlockDeviceCore(loan._id).catch(() => {});
      }
    } else if (totalDueAmount > 0) {
      if (isManuallyUnlocked) {
        effectiveStatus = "UNLOCKED"; // Admin override respected
        lockReason = "MANUAL_UNLOCK_OVERRIDE";
        console.log("Admin manual unlock override active.");
      } else if (gracePeriodExpired) {
        effectiveStatus = "LOCKED";
        lockReason = "AUTO_LOCK_OVERDUE";
        console.log(
          `Auto-lock triggered: ${daysOverdue} days overdue (Grace period: ${GRACE_PERIOD_DAYS} days)`,
        );
      } else {
        effectiveStatus = "UNLOCKED";
        lockReason = "GRACE_PERIOD_ACTIVE";
        console.log(
          `Grace period active: ${daysOverdue}/${GRACE_PERIOD_DAYS} days overdue`,
        );
      }
    } else if (totalDueAmount <= 0) {
      effectiveStatus = "UNLOCKED";
      lockReason = null;
    }

    // SYNC: If the calculated status differs from DB, update DB so Admin Panel sees it
    if (loan.deviceUnlockStatus !== effectiveStatus) {
      console.log(
        `Syncing DB Status: ${loan.deviceUnlockStatus} -> ${effectiveStatus} (Due: ${totalDueAmount})`,
      );
      await Loan.findByIdAndUpdate(loan._id, {
        deviceUnlockStatus: effectiveStatus,
      });
      // Update local object for response
      loan.deviceUnlockStatus = effectiveStatus;
    }

    console.log(
      `IMEI ${imei} status: ${loan.deviceUnlockStatus}, Due Amount: ${totalDueAmount} -> Effective: ${effectiveStatus}`,
    );

    // Check for location request
    let requestLocation = false;
    if (loan.requestLocation) {
      requestLocation = true;
      // Clear the flag immediately so we don't spam requests
      await Loan.findByIdAndUpdate(loan._id, { requestLocation: false });
      console.log(
        `Sending Location Request command to device ${imei || phone}`,
      );
    }

    // Check for SIM info request
    if (loan.requestSimInfo) {
      // Clear the flag immediately so we don't spam requests
      await Loan.findByIdAndUpdate(loan._id, { requestSimInfo: false });
      console.log(
        `Sending SIM Info Request command to device ${imei || phone}`,
      );
    }

    return res.status(200).json({
      success: true,
      status: effectiveStatus,
      lockReason: lockReason,
      loanCleared: lockReason === "LOAN_CLEARED",
      daysOverdue: daysOverdue,
      nextDueDate: lockReason === "LOAN_CLEARED" ? null : nextDueDate,
      loanId: loan._id,
      requestLocation, // Send command to device
      requestSimInfo: loan.requestSimInfo, // Send command to device
      data: {
        ...loan.toObject(),
        totalDueAmount,
        breakdown: {
          principal: installmentPrincipalDue,
          lateFees,
          bounceFees,
        },
        nextDueDate,
      },
      isOverdue: totalDueAmount > 0,
      isPaid: lockReason === "LOAN_CLEARED",
      policy: getEffectivePolicy(loan, totalDueAmount),
    });
  } catch (error) {
    console.error("Public Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching status",
      error: error.message,
    });
  }
};

const updateDevicePolicy = async (req, res) => {
  try {
    const { loanId } = req.params;
    const policy = req.body; // { isResetAllowed: boolean, isUninstallAllowed: boolean }

    console.log(`Updating policy for Loan ${loanId}:`, policy);

    if (!req.isSuperAdmin) {
      const owner = await Loan.findById(loanId).select("createdBy");
      if (!owner) {
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });
      }
      if (String(owner.createdBy) !== String(req.userId)) {
        return res
          .status(403)
          .json({ success: false, message: "Not authorized for this device" });
      }
    }

    // Use granular $set for nested fields to avoid overwriting the entire object
    const updateObj = {};
    for (const key in policy) {
      updateObj[`devicePolicy.${key}`] = policy[key];
    }

    const loan = await Loan.findByIdAndUpdate(
      loanId,
      { $set: updateObj },
      { new: true },
    ).populate("customerId");

    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }

    // --- Send Notification to Device ---
    // This allows the device to sync policy immediately without waiting for polling
    if (loan.customerId) {
      try {
        const customer = loan.customerId;
        const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");
        let user = await User.findOne({ phone: customer.customerMobileNumber });
        if (!user) {
          user = await User.findOne({ phone: searchPhone });
        }

        if (user && user.pushNotificationToken) {
          // Calculate effective policy (including overdue status) for the device
          // We need totalDueAmount for this loan
          let totalDueAmount = 0;
          const now = new Date();
          if (loan.installments && Array.isArray(loan.installments)) {
            totalDueAmount = loan.installments.reduce((sum, inst) => {
              if (inst.status === "PENDING" && new Date(inst.dueDate) <= now) {
                return sum + (inst.amount || 0);
              }
              return sum;
            }, 0);
          }

          const effectivePolicy = getEffectivePolicy(loan, totalDueAmount);

          console.log(
            `Policy Updated. Sending FCM to user: ${user._id} for Loan ${loan._id}`,
          );
          await sendNotificationCore({
            userId: user._id,
            title: "Policy Update",
            body: "Device policy has been updated.",
            data: {
              type: "POLICY_UPDATE",
              policy: JSON.stringify(effectivePolicy),
            },
            silent: true,
            highPriority: true,
          });
        }
      } catch (notifyError) {
        console.error("Error sending policy update notification:", notifyError);
      }
    }
    // -----------------------------------

    res
      .status(200)
      .json({ success: true, message: "Device policy updated", data: loan });
  } catch (error) {
    console.error("Update Policy Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating policy",
      error: error.message,
    });
  }
};

const lockDeviceBulk = async (req, res) => {
  try {
    const { loanIds } = req.body; // Array of IDs
    if (!loanIds || !Array.isArray(loanIds)) {
      return res
        .status(400)
        .json({ success: false, message: "loanIds must be an array" });
    }

    console.log("---------------- BULK LOCK DEVICE REQUEST ----------------");
    const allowedIds = await filterOwnedLoanIds(loanIds, req);
    const results = [];
    for (const id of loanIds) {
      if (!allowedIds.has(String(id))) {
        results.push({ id, success: false, message: "Not authorized" });
        continue;
      }
      try {
        const result = await lockDeviceCore(id);
        results.push({ id, ...result });
      } catch (e) {
        results.push({ id, success: false, message: e.message });
      }
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in bulk lock",
      error: error.message,
    });
  }
};

const unlockDeviceBulk = async (req, res) => {
  try {
    const { loanIds } = req.body;
    if (!loanIds || !Array.isArray(loanIds)) {
      return res
        .status(400)
        .json({ success: false, message: "loanIds must be an array" });
    }

    console.log("---------------- BULK UNLOCK DEVICE REQUEST ----------------");
    const allowedIds = await filterOwnedLoanIds(loanIds, req);
    const results = [];
    for (const id of loanIds) {
      if (!allowedIds.has(String(id))) {
        results.push({ id, success: false, message: "Not authorized" });
        continue;
      }
      try {
        const result = await unlockDeviceCore(id);
        results.push({ id, ...result });
      } catch (e) {
        results.push({ id, success: false, message: e.message });
      }
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error in bulk unlock",
      error: error.message,
    });
  }
};

const updateDevicePolicyBulk = async (req, res) => {
  try {
    const { loanIds, policy } = req.body;
    if (!loanIds || !Array.isArray(loanIds)) {
      return res
        .status(400)
        .json({ success: false, message: "loanIds must be an array" });
    }

    console.log("---------------- BULK POLICY UPDATE REQUEST ----------------");

    // Granular update to prevent overwriting the entire devicePolicy object
    const updateObj = {};
    for (const key in policy) {
      updateObj[`devicePolicy.${key}`] = policy[key];
    }

    // 1. Update DB
    await Loan.updateMany({ _id: { $in: loanIds } }, { $set: updateObj });

    // 2. Fetch loans with customer info to send notifications
    const loans = await Loan.find({ _id: { $in: loanIds } }).populate(
      "customerId",
    );

    // 3. Send notifications asynchronously
    for (const loan of loans) {
      try {
        const customer = loan.customerId;
        if (customer && customer.customerMobileNumber) {
          const searchPhone = customer.customerMobileNumber.replace(/\D/g, "");
          const user = await User.findOne({
            $or: [
              { phone: customer.customerMobileNumber },
              { phone: searchPhone },
            ],
          });

          if (user && user.pushNotificationToken) {
            // Calculate effective policy (including overdue status) for the device
            let totalDueAmount = 0;
            const now = new Date();
            if (loan.installments && Array.isArray(loan.installments)) {
              totalDueAmount = loan.installments.reduce((sum, inst) => {
                if (
                  inst.status === "PENDING" &&
                  new Date(inst.dueDate) <= now
                ) {
                  return sum + (inst.amount || 0);
                }
                return sum;
              }, 0);
            }

            const effectivePolicy = getEffectivePolicy(loan, totalDueAmount);

            console.log(
              `Sending Bulk FCM to User: ${user._id} for Loan ${loan._id}`,
            );
            await sendNotificationCore({
              userId: user._id,
              title: "Policy Update",
              body: "Device policy has been updated.",
              data: {
                type: "POLICY_UPDATE",
                policy: JSON.stringify(effectivePolicy),
              },
              silent: true,
              highPriority: true,
            });
          }
        }
      } catch (notifyError) {
        console.error(
          `Error sending bulk notify for loan ${loan._id}:`,
          notifyError,
        );
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Bulk device policy updated" });
  } catch (error) {
    console.error("Bulk Update Policy Error:", error);
    res.status(500).json({
      success: false,
      message: "Error in bulk policy update",
      error: error.message,
    });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { deviceId, latitude, longitude } = req.body;
    console.log("---------------- UPDATE LOCATION ----------------");
    console.log(`Device: ${deviceId}, Lat: ${latitude}, Long: ${longitude}`);

    if (!deviceId || !latitude || !longitude) {
      console.log("❌ Missing location data:", {
        deviceId,
        latitude,
        longitude,
      });
      return res.status(400).json({
        success: false,
        message: "Device ID, Latitude, and Longitude are required",
      });
    }

    // Find loan by IMEI
    const loan = await Loan.findOne({
      $or: [{ imeiNumber1: deviceId }, { imeiNumber2: deviceId }],
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found for this device",
      });
    }

    // Update location and reset request flag
    loan.location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      updatedAt: new Date(),
    };
    loan.requestLocation = false; // Reset the flag since we got the location

    await loan.save();

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({
      success: false,
      message: "Error updating location",
      error: error.message,
    });
  }
};

const requestDeviceLocation = async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findByIdAndUpdate(
      loanId,
      { requestLocation: true },
      { new: true },
    );

    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Location request sent to device" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error requesting location",
      error: error.message,
    });
  }
};

const requestDeviceSimInfo = async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findByIdAndUpdate(
      loanId,
      { requestSimInfo: true },
      { new: true },
    );

    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "SIM info request sent to device" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error requesting SIM info",
      error: error.message,
    });
  }
};

const markAutoDebitFailure = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { installmentNumber } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    }

    const installment = loan.installments.find(
      (inst) => inst.installmentNumber === installmentNumber,
    );
    if (!installment) {
      return res
        .status(404)
        .json({ success: false, message: "Installment not found" });
    }

    if (installment.status === "PAID") {
      return res
        .status(400)
        .json({ success: false, message: "Installment already paid" });
    }

    // Apply bounce fee
    installment.bounceFee = (installment.bounceFee || 0) + 400;
    if (installment.status === "PENDING") {
      installment.status = "OVERDUE";
    }

    await loan.save();

    res.status(200).json({
      success: true,
      message: "Auto-debit failure marked and bounce fee applied",
      data: loan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking auto-debit failure",
      error: error.message,
    });
  }
};

const requestDeviceLocationBulk = async (req, res) => {
  try {
    const { loanIds } = req.body;
    if (!loanIds || !Array.isArray(loanIds)) {
      return res
        .status(400)
        .json({ success: false, message: "loanIds must be an array" });
    }

    await Loan.updateMany(
      { _id: { $in: loanIds } },
      { $set: { requestLocation: true } },
    );

    res
      .status(200)
      .json({ success: true, message: "Location request sent to all devices" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error requesting bulk location",
      error: error.message,
    });
  }
};

const requestDeviceSimInfoBulk = async (req, res) => {
  try {
    const { loanIds } = req.body;
    if (!loanIds || !Array.isArray(loanIds)) {
      return res
        .status(400)
        .json({ success: false, message: "loanIds must be an array" });
    }

    await Loan.updateMany(
      { _id: { $in: loanIds } },
      { $set: { requestSimInfo: true } },
    );

    res
      .status(200)
      .json({ success: true, message: "SIM info request sent to all devices" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error requesting bulk SIM info",
      error: error.message,
    });
  }
};

module.exports = {
  getMyLoans,
  createCustomerloan,
  getAllCustomersloan,
  getCustomerloanById,
  updateCustomerloan,
  deleteCustomerloan,
  getAllloans,
  getDueInstallments,
  lockDevice,
  unlockDevice,
  getMobileDeviceStatus,
  getDeviceStatusByImei,
  updateDevicePolicy,
  lockDeviceBulk,
  unlockDeviceBulk,
  updateDevicePolicyBulk,
  requestDeviceLocation,
  requestDeviceSimInfo,
  requestDeviceLocationBulk,
  requestDeviceSimInfoBulk,
  markAutoDebitFailure,
  updateSimDetails,
  getSimDetails,
  updateLocation,
  recordFullPayment,
};
