const User = require("../models/UserModel");

const admin = require("../config/firebaseAdmin");
const NotificationModel = require("../models/Notification.model");

exports.sendNotificationCore = async ({
  userId,
  title,
  body,
  data,
  topic,
  imageUrl,
  silent,
  highPriority,
  androidChannelId = "high_importance_channel",
  clickAction = "OPEN_APP",
}) => {
  if (!title || !body) {
    throw {
      status: 400,
      error: "Missing required fields",
      required: ["title", "body"],
    };
  }
  let user = undefined;
  if (userId) {
    user = await User.findById(userId).select("pushNotificationToken");
  }

  const token = user?.pushNotificationToken || undefined;

  const isToken = Boolean(token);
  const isTopic = Boolean(topic);
  const message = {};

  if (isToken) message.token = token;
  if (isTopic && !isToken) message.topic = topic;

  message.data = {
    ...data,
    title,
    body,
    type: data.type || "v-locker",
    imageUrl: data?.imageUrl || "",
  };
  message.android = {
    priority: highPriority ? "high" : "normal",
    notification: silent
      ? {}
      : {
          clickAction,
          channelId: androidChannelId,
          icon: "ic_notification",
          color: "#4CAF50",
          sound: "default",
          tag: "general_notification",
          imageUrl,
        },
  };

  message.apns = {
    headers: {
      "apns-priority": silent ? "5" : "10",
      "apns-push-type": silent ? "background" : "alert",
    },
    payload: {
      aps: {
        "content-available": silent ? 1 : 0,

        ...(silent
          ? {}
          : {
              sound: "default",
              alert: { title, body },
            }),
      },
    },
  };

  const response = await admin.messaging().send(message);

  await NotificationModel.create({ userId: userId, title, body, data });

  return {
    success: true,
    messageId: response,
    message: "Notification sent successfully to user",
  };
};
