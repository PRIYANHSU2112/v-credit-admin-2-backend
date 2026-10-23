const AuditLog = require("../models/AuditLog.model");

const createAuditLog = async ({
  action,
  description,
  userId,
  userName,
  role,
  target,
  targetId,
  severity = "info",
  req,
  metadata,
}) => {
  try {
    await AuditLog.create({
      action,
      description,
      userId,
      userName,
      role,
      target,
      targetId,
      severity,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
      userAgent: req?.headers?.["user-agent"] || null,
      metadata,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
};

module.exports = { createAuditLog, timeAgo };
