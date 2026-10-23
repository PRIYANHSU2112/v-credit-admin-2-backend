const Notification = require("../../models/Notification.model");

let admin = null;
try {
  admin = require("../../config/firebaseAdmin");
} catch (e) {
  admin = null;
}

/**
 * Persist an in-app notification and (best effort) push via FCM.
 * Never throws — notification failures must not break the main workflow.
 */
const notify = async ({ userId, title, body, data = {}, fcmToken }) => {
  try {
    if (userId) {
      await Notification.create({ userId, title, body, data });
    }
  } catch (err) {
    console.error("Notification persist failed:", err.message);
  }

  // Fire-and-forget FCM push: never block (or fail) the request path on push latency.
  if (fcmToken && admin && admin.messaging) {
    admin
      .messaging()
      .send({
        token: fcmToken,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        ),
        android: { priority: "high" },
      })
      .catch((err) => console.error("FCM push failed:", err.message));
  }
};

/**
 * Send a silent data-only FCM message (used to wake the device for commands / policy sync).
 */
const pushData = async (fcmToken, data = {}) => {
  if (!fcmToken || !admin || !admin.messaging) return false;
  // Fire-and-forget — do not block the request on FCM latency.
  admin
    .messaging()
    .send({
      token: fcmToken,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
      android: { priority: "high" },
    })
    .catch((err) => console.error("FCM data push failed:", err.message));
  return true;
};

module.exports = { notify, pushData };
