const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const ImpersonationLog = require("../models/ImpersonationLog.model");

const ENTERPRISE_ROLES = ["super_admin", "stockist", "distributor", "dealer"];

const loadEnterpriseUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    req.enterpriseUser = user;
    req.enterpriseRole =
      user.enterpriseRole || (user.role === "admin" ? "super_admin" : null);
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const requireEnterpriseRole = (...roles) => (req, res, next) => {
  const role = req.enterpriseRole;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Insufficient enterprise permissions",
    });
  }
  next();
};

const loginAs = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const actor = req.enterpriseUser;

    if (!["super_admin", "stockist", "distributor"].includes(actor.enterpriseRole)) {
      return res.status(403).json({ success: false, message: "Cannot impersonate" });
    }

    const target = await User.findById(targetUserId);
    if (!target || target.isDeleted) {
      return res.status(404).json({ success: false, message: "Target user not found" });
    }

    const descendants = await require("../services/hierarchyTree.service").getDescendantIds(
      actor._id,
    );
    if (
      actor.enterpriseRole !== "super_admin" &&
      !descendants.includes(target._id.toString())
    ) {
      return res.status(403).json({ success: false, message: "Target not in your hierarchy" });
    }

    const impersonationToken = jwt.sign(
      {
        userId: target._id,
        role: target.role,
        enterpriseRole: target.enterpriseRole,
        impersonatedBy: actor._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    await ImpersonationLog.create({
      originalUserId: actor._id,
      impersonatedUserId: target._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      reason: req.body.reason,
    });

    return res.status(200).json({
      success: true,
      token: impersonationToken,
      user: {
        id: target._id,
        name: target.name,
        email: target.email,
        enterpriseRole: target.enterpriseRole,
      },
      impersonatedBy: { id: actor._id, name: actor.name },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  ENTERPRISE_ROLES,
  loadEnterpriseUser,
  requireEnterpriseRole,
  loginAs,
};
