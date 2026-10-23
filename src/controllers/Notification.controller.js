const mongoose = require("mongoose");
const { sendNotificationCore } = require("../lib/notifications");
const NotificationModel = require("../models/Notification.model");
const defaults = {
  topic: "allUsers",
  imageUrl: undefined,
  silent: false,
  highPriority: true,
  androidChannelId: "high_importance_channel",
  clickAction: "OPEN_APP",
  data: {},
};

exports.sendNotification = async (req, res) => {
  try {
    const payload = { ...defaults, ...req.body };
    const result = await sendNotificationCore(payload);
    return res.json(result);
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ error: err || "Internal server error" });
  }
};

exports.getNotification = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const userId = req.userId;
    const history = await NotificationModel.find({
      userId: userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalHistory = await NotificationModel.countDocuments({
      userId: userId,
    });
    const totalPages = Math.ceil(totalHistory / limit);

    const pagination = {
      totalNotifications: totalHistory,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
    };
    return res.status(200).json({
      status: false,
      message: "notification history fetched successfully",
      data: history,
      pagination,
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err || "Internal server error" });
  }
};

exports.getAllnotification = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};
    const { userId } = req.query;
    if (userId) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    const history = await NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalHistory = await NotificationModel.countDocuments({});
    const totalPages = Math.ceil(totalHistory / limit);

    const pagination = {
      totalNotifications: totalHistory,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
    };
    return res.status(200).json({
      status: false,
      message: "notification history fetched successfully",
      data: history,
      pagination,
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, error: err || "Internal server error" });
  }
};
exports.getNotificationById = async (req, res) => {
  try {
    const id = req.params.id;

    const notification = await NotificationModel.findByIdAndUpdate(
      id,
      { readStatus: true },
      { new: true }
    );

    return res.status(200).json({
      status: true,
      message: "notification fetched successfully",
      data: notification,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "something went wrong",
    });
  }
};
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.userId;

    await NotificationModel.updateMany(
      {
        userId: userId,
      },
      {
        $set: {
          readStatus: true,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "all messages marked  as read successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark all as read ",
      error: err.message,
    });
  }
};
