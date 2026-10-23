const {
  activateForDevice,
  ActivationError,
} = require("../../services/mobile/activation.service");
const { notify } = require("../../services/mobile/notify.service");

/**
 * STEP 5 + 6 + 7: verify device + assigned key, activate, return policy.
 */
const activate = async (req, res) => {
  try {
    const result = await activateForDevice({
      user: req.mobileUser,
      deviceInfo: req.body,
      performedBy: req.userId,
      req,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyActive
        ? "Device already activated"
        : "Device activated successfully",
      data: {
        keyNumber: result.key.keyNumber,
        status: result.key.status,
        activationDate: result.key.activationDate,
        expiryDate: result.key.expiryDate,
        deviceId: result.key.deviceId,
        policy: result.policy,
      },
    });
  } catch (error) {
    if (error instanceof ActivationError) {
      // notify failure (best effort)
      await notify({
        userId: req.userId,
        title: "Activation failed",
        body: error.message,
        data: { type: "ACTIVATION_FAILED", code: error.code },
        fcmToken: req.body.fcmToken,
      });
      return res
        .status(error.httpStatus || 400)
        .json({ success: false, code: error.code, message: error.message });
    }
    console.error("Activation error:", error.message);
    return res
      .status(500)
      .json({ success: false, code: "ACTIVATION_ERROR", message: "Activation failed" });
  }
};

module.exports = { activate };
