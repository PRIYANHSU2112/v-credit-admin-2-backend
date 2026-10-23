const crypto = require("crypto");
const RemoteCommand = require("../../models/RemoteCommand.model");
const Device = require("../../models/Device.model");
const { pushData, notify } = require("./notify.service");

const COMMAND_TTL_MINUTES = parseInt(process.env.COMMAND_TTL_MINUTES || "60", 10);

/** Commands that also change persistent device lock state. */
const LOCK_EFFECT = {
  LOCK_DEVICE: { isLocked: true, lockStatus: "LOCKED" },
  UNLOCK_DEVICE: { isLocked: false, lockStatus: "UNLOCKED" },
};

/**
 * Enqueue a remote command for a device and wake it via a silent FCM push.
 */
const enqueueCommand = async ({ deviceId, type, payload = {}, issuedBy, issuedByRole }) => {
  const device = await Device.findOne({ deviceId });
  if (!device) throw new Error("Device not found");

  const commandRef = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + COMMAND_TTL_MINUTES * 60 * 1000);

  const command = await RemoteCommand.create({
    deviceId,
    type,
    payload,
    issuedBy,
    issuedByRole,
    commandRef,
    status: "PENDING",
    expiresAt,
  });

  // Wake the device so it polls immediately (best effort).
  await pushData(device.fcmToken, {
    type: "REMOTE_COMMAND",
    commandRef,
    commandType: type,
  });

  return command;
};

/**
 * Return pending (non-expired) commands for a device and mark them SENT.
 * Expired pending commands are flipped to EXPIRED.
 */
const fetchPendingCommands = async (deviceId) => {
  const now = new Date();

  await RemoteCommand.updateMany(
    { deviceId, status: "PENDING", expiresAt: { $lt: now } },
    { status: "EXPIRED" },
  );

  const pending = await RemoteCommand.find({
    deviceId,
    status: "PENDING",
  }).sort({ createdAt: 1 });

  if (pending.length) {
    const ids = pending.map((c) => c._id);
    await RemoteCommand.updateMany(
      { _id: { $in: ids } },
      { status: "SENT", sentAt: now },
    );
  }

  return pending.map((c) => ({
    commandRef: c.commandRef,
    type: c.type,
    payload: c.payload,
    createdAt: c.createdAt,
  }));
};

/**
 * Acknowledge command execution result from the device. Idempotent by commandRef.
 */
const ackCommand = async ({ commandRef, status, resultMessage, executionTimeMs }) => {
  const command = await RemoteCommand.findOne({ commandRef });
  if (!command) throw new Error("Command not found");

  // Idempotent: if already terminal, return as-is (replay protection).
  if (["SUCCESS", "FAILED", "ERROR", "EXPIRED"].includes(command.status)) {
    return command;
  }

  command.status = status; // SUCCESS | FAILED | ERROR
  command.resultMessage = resultMessage;
  command.executedAt = new Date();
  command.executionTimeMs = executionTimeMs;
  await command.save();

  // Reflect confirmed lock-state changes on the device record.
  if (status === "SUCCESS" && LOCK_EFFECT[command.type]) {
    await Device.updateOne({ deviceId: command.deviceId }, LOCK_EFFECT[command.type]);
  }

  // Notify the issuer that the command executed.
  if (command.issuedBy) {
    await notify({
      userId: command.issuedBy,
      title: "Remote command executed",
      body: `${command.type} → ${status}`,
      data: { deviceId: command.deviceId, commandRef, type: command.type, status },
    });
  }

  return command;
};

module.exports = { enqueueCommand, fetchPendingCommands, ackCommand, LOCK_EFFECT };
