const mongoose = require("mongoose");
const Keys = require("../models/KeysModel");
const User = require("../models/UserModel");
const EnterpriseKey = require("../models/EnterpriseKey.model");
const { generateKeys } = require("../services/keyEnterprise.service");
const { generateBatchId } = require("../utils/keyGenerator");
const { createAuditLog } = require("../services/audit.service");

const mapEnterpriseKeyRow = (key) => {
  const usable = ["Generated", "Allocated", "Transferred", "Assigned"].includes(
    key.status,
  );
  return {
    _id: key._id,
    code: key.keyNumber,
    keyCode: key.keyNumber,
    batchId: key.batchId,
    status: key.status === "Activated" ? "Used" : usable ? "Available" : key.status,
    enterpriseStatus: key.status,
    createdAt: key.createdAt,
    isEnterpriseKey: true,
  };
};

const requestKeys = async (req, res) => {
  try {
    const userId = req.userId;
    const requestedKeys = req?.body?.requestKeys;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "User authentication required",
      });
    }

    if (!requestedKeys || requestedKeys.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Request keys are required",
      });
    }

    const newRequestKeys = await Keys.create({
      userId: userId,
      requestKeys: requestedKeys,
    });

    return res.status(200).json({
      status: true,
      message: "Keys requested successfully",
      data: newRequestKeys,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to request keys",
      error: error.message,
    });
  }
};

const updateStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const keyId = req.params.keyId;

    if (!keyId) {
      return res.status(400).json({
        status: false,
        message: "Key ID is required",
      });
    }

    if (!req.body.status) {
      return res.status(400).json({
        status: false,
        message: "Status is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(keyId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid key ID format",
      });
    }

    session.startTransaction();

    const isExist = await Keys.findOne({
      _id: keyId,
    }).session(session);

    if (!isExist) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: false,
        message: "Requested key does not exist",
      });
    }

    // Allow updates if status is Pending OR if we are Rejecting an already Approved request
    if (isExist.status !== "Pending") {
      // If current status is NOT Pending, we only allow transition if:
      // Current is Approved AND New is Rejected
      if (!(isExist.status === "Approved" && req.body.status === "Rejected")) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: false,
          message:
            "Only Pending requests can be updated, or Approved requests can be Rejected.",
          currentStatus: isExist.status,
        });
      }
    }

    const data = await Keys.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(keyId) },
      { $set: req.body },
      { new: true, session: session }
    );

    if (req.body.status === "Approved" && isExist.status !== "Approved") {
      const batchId = generateBatchId();
      try {
        const generated = await generateKeys({
          quantity: isExist.requestKeys,
          ownerId: isExist.userId,
          performedBy: req.userId,
          skipUserBalanceUpdate: true,
          req,
        });
        // Must reuse the outer transaction session — updating the same Keys
        // doc without the session deadlocks against the write lock held above.
        await Keys.findByIdAndUpdate(
          data._id,
          {
            batchId: generated.batchId,
            code: generated.keys?.[0]?.keyNumber || batchId,
          },
          { session }
        );
      } catch (genErr) {
        console.error("Key generation on approve:", genErr.message);
        await Keys.findByIdAndUpdate(
          data._id,
          { batchId, code: batchId },
          { session }
        );
      }

      await createAuditLog({
        action: `Approved ${isExist.requestKeys} keys`,
        userId: req.userId,
        role: "admin",
        target: `Request ${keyId}`,
        severity: "success",
        req,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: true,
      message: "Status updated successfully",
      data: data,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    return res.status(500).json({
      status: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
};

const userkeyHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const userId = req.userId;

    const user = await User.findById(userId).select("keys enterpriseRole name");
    const enterpriseRole = req.enterpriseRole || user?.enterpriseRole;

    if (enterpriseRole && enterpriseRole !== "super_admin") {
      const filter = { currentOwnerId: userId, isDeleted: false };
      const [keys, totalKeys] = await Promise.all([
        EnterpriseKey.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        EnterpriseKey.countDocuments(filter),
      ]);

      const availableCount = await EnterpriseKey.countDocuments({
        ...filter,
        status: { $in: ["Generated", "Allocated", "Transferred", "Assigned"] },
      });

      const pagination = {
        totalKeys,
        totalPages: Math.ceil(totalKeys / limit) || 1,
        currentPage: page,
        limit,
        balanceKeys: user?.keys ?? availableCount,
        availableKeys: availableCount,
      };

      return res.status(200).json({
        status: true,
        message: "key inventory fetched successfully",
        data: keys.map(mapEnterpriseKeyRow),
        pagination,
      });
    }

    const allKeys = await Keys.find({
      userId: userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId");
    const totalKeys = await Keys.countDocuments({
      userId: userId,
    });
    const totalPages = Math.ceil(totalKeys / limit);

    const pagination = {
      totalKeys: totalKeys,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
    };
    return res.status(200).json({
      status: true,
      message: "key history fetched successfully",
      data: allKeys,
      pagination: pagination,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch keys history",
      error: error.message,
    });
  }
};
const allKeys = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query?.status || null;
    const search = req.query?.search || null;
    const filter = {};
    if (status?.trim()) {
      filter.status = status.trim();
    }
    const searchFilter = {};

    if (search?.trim()) {
      searchFilter.$or = [{ "userId.name": { $regex: search, $options: "i" } }];
    }
    const allKeys = await Keys.aggregate([
      { $match: filter },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },

      { $unwind: "$userId" },

      {
        $match: searchFilter,
      },

      { $sort: { createdAt: -1 } },

      { $skip: skip },

      { $limit: limit },
    ]);

    const totalKeys = await Keys.countDocuments(filter);
    const totalPages = Math.ceil(totalKeys / limit);

    const pagination = {
      totalKeys: totalKeys,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
    };
    return res.status(200).json({
      status: true,
      message: "all keys fetched successfully",
      data: allKeys,
      pagination: pagination,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch all keys",
      error: error.message,
    });
  }
};

module.exports = {
  requestKeys,
  updateStatus,
  userkeyHistory,
  allKeys,
};
