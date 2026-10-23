const bcrypt = require("bcrypt");
const User = require("../models/UserModel");
const KeyInventory = require("../models/KeyInventory.model");
const { generateEntityCode } = require("../utils/keyGenerator");
const { canManageRole } = require("./keyEnterprise.service");
const { getDescendantIds } = require("./hierarchyTree.service");
const { createAuditLog } = require("./audit.service");

const formatUserRow = async (user, extra = {}) => {
  const inv = await KeyInventory.findOne({ userId: user._id });
  const parent = user.parentId
    ? await User.findById(user.parentId).select("name entityCode")
    : null;

  const base = {
    id: user.entityCode || user._id.toString(),
    _id: user._id,
    name: user.name || "Unnamed",
    email: user.email || "—",
    phone: user.phone || "—",
    city: user.city || "—",
    status: user.enterpriseStatus || "Active",
    keys: inv?.totalKeys ?? user.keys ?? 0,
    available: inv?.availableKeys ?? user.keys ?? 0,
    parentId: user.parentId || null,
    parentName: parent?.name || "—",
    lastActive: user.updatedAt
      ? `${Math.max(1, Math.floor((Date.now() - user.updatedAt) / 3600000))}h ago`
      : "—",
    ...extra,
  };

  if (user.enterpriseRole === "stockist") {
    const distributors = await User.countDocuments({
      parentId: user._id,
      enterpriseRole: "distributor",
      isDeleted: false,
    });
    return {
      ...base,
      territory: user.territory || "—",
      gst: user.gst || "—",
      distributors,
      revenue: (inv?.activatedKeys ?? 0) * 250,
    };
  }

  if (user.enterpriseRole === "distributor") {
    const dealers = await User.countDocuments({
      parentId: user._id,
      enterpriseRole: "dealer",
      isDeleted: false,
    });
    return {
      ...base,
      stockist: parent?.name || "—",
      dealers,
      onboarded: user.createdAt
        ? user.createdAt.toISOString().slice(0, 10)
        : "—",
    };
  }

  if (user.enterpriseRole === "dealer") {
    const activations = inv?.activatedKeys ?? 0;
    const users = await require("../models/Customer.model").countDocuments({
      createdBy: user._id,
    });
    return {
      ...base,
      distributor: parent?.name || "—",
      users,
      activations,
      lastActive: `${Math.max(1, Math.floor((Date.now() - user.updatedAt) / 60000))}m ago`,
    };
  }

  return base;
};

const getNextEntityCode = async (role) => {
  const prefix =
    role === "stockist" ? "STK" : role === "distributor" ? "DST" : "DLR";
  const count = await User.countDocuments({ enterpriseRole: role });
  return generateEntityCode(prefix, 1001 + count);
};

const createHierarchyUser = async ({
  actor,
  role,
  data,
  req,
}) => {
  if (!canManageRole(actor.enterpriseRole, role)) {
    throw new Error(`Cannot create ${role} with your role`);
  }

  if (data.email) {
    const normalizedEmail = String(data.email).toLowerCase().trim();
    const existing = await User.findOne({
      email: normalizedEmail,
      isDeleted: false,
    });
    if (existing) {
      throw new Error("This email is already registered. Use a different email.");
    }
    data.email = normalizedEmail;
  }

  const entityCode = await getNextEntityCode(role);
  const hashedPassword = data.password
    ? await bcrypt.hash(data.password, 10)
    : await bcrypt.hash(`ChangeMe@${Date.now()}`, 10);

  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: hashedPassword,
    role: "admin",
    enterpriseRole: role,
    parentId: data.parentId || data.parentStockistId || actor._id,
    territory: data.territory,
    city: data.city,
    gst: data.gst,
    entityCode,
    enterpriseStatus: data.status || "Active",
    isProfileCompleted: true,
  });

  await createAuditLog({
    action: `Created ${role}`,
    userId: actor._id,
    userName: actor.name,
    role: actor.enterpriseRole,
    target: `${user.name} (${user.city || "—"})`,
    severity: "info",
    req,
  });

  return formatUserRow(user);
};

const listByRole = async ({
  role,
  actor,
  page = 1,
  limit = 50,
  search = "",
}) => {
  const filter = { enterpriseRole: role, isDeleted: false };

  if (actor.enterpriseRole !== "super_admin") {
    const descendants = await require("./hierarchyTree.service").getDescendantIds(
      actor._id,
    );
    filter._id = { $in: descendants };
  }

  if (search?.trim()) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { entityCode: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const data = await Promise.all(users.map(u => formatUserRow(u)));

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      totalItems: total,
      limit,
    },
  };
};

const resetUserPassword = async ({ actor, userId, password, req }) => {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new Error("User not found");
  }

  if (!user.enterpriseRole) {
    throw new Error("Password reset is only available for enterprise users");
  }

  if (actor.enterpriseRole === "super_admin") {
    // full access
  } else if (actor.enterpriseRole === "stockist" || actor.enterpriseRole === "distributor") {
    if (!canManageRole(actor.enterpriseRole, user.enterpriseRole)) {
      throw new Error("You cannot reset passwords for this user role");
    }
    const descendants = await getDescendantIds(actor._id);
    if (!descendants.includes(user._id.toString())) {
      throw new Error("You can only reset passwords for users in your network");
    }
  } else {
    throw new Error("You do not have permission to reset passwords");
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  await createAuditLog({
    action: `Reset password for ${user.enterpriseRole}`,
    userId: actor._id,
    userName: actor.name,
    role: actor.enterpriseRole,
    target: `${user.name} (${user.email || user.entityCode || user._id})`,
    severity: "warning",
    req,
  });

  return {
    id: user.entityCode || user._id.toString(),
    email: user.email || "",
    name: user.name || "User",
    enterpriseRole: user.enterpriseRole,
  };
};

module.exports = {
  formatUserRow,
  createHierarchyUser,
  listByRole,
  getNextEntityCode,
  resetUserPassword,
};
