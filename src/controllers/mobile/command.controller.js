const {
  enqueueCommand,
  fetchPendingCommands,
  ackCommand,
} = require("../../services/mobile/command.service");

// STEP 11 (device side): poll pending commands.
const poll = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const commands = await fetchPendingCommands(deviceId);
    return res.status(200).json({ success: true, data: commands });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// STEP 11 (device side): acknowledge execution result.
const ack = async (req, res) => {
  try {
    const { commandRef, status, resultMessage, executionTimeMs } = req.body;
    const command = await ackCommand({ commandRef, status, resultMessage, executionTimeMs });
    return res.status(200).json({
      success: true,
      data: { commandRef: command.commandRef, status: command.status },
    });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
};

// STEP 11 (admin side): enqueue a remote command for a device.
const issue = async (req, res) => {
  try {
    const { deviceId, type, payload } = req.body;
    const command = await enqueueCommand({
      deviceId,
      type,
      payload,
      issuedBy: req.userId || req.enterpriseUser?._id,
      issuedByRole: req.enterpriseRole || req.enterpriseUser?.enterpriseRole,
    });
    return res.status(201).json({
      success: true,
      message: "Command queued",
      data: { commandRef: command.commandRef, type: command.type, status: command.status },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { poll, ack, issue };
