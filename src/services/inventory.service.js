const mongoose = require("mongoose");
const User = require("../models/UserModel");
const KeyInventory = require("../models/KeyInventory.model");
const EnterpriseKey = require("../models/EnterpriseKey.model");
const { getDescendantIds } = require("./hierarchyTree.service");

const ensureInventory = async (userId, session) => {
  let inv = await KeyInventory.findOne({ userId }).session(session || null);
  if (!inv) {
    inv = await KeyInventory.create([{ userId }], { session: session || undefined });
    return inv[0];
  }
  return inv;
};

const recalculateInventory = async (userId, session) => {
  const opts = session ? { session } : {};
  const inv = await ensureInventory(userId, session);

  const baseFilter = { currentOwnerId: userId, isDeleted: false };

  const [
    totalKeys,
    availableKeys,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    transferredOut,
    receivedKeys,
  ] = await Promise.all([
    EnterpriseKey.countDocuments(baseFilter, opts),
    EnterpriseKey.countDocuments(
      { ...baseFilter, status: { $in: ["Generated", "Allocated", "Transferred", "Assigned"] } },
      opts,
    ),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Activated" }, opts),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Expired" }, opts),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Locked" }, opts),
    EnterpriseKey.countDocuments(
      { "history.fromUserId": userId, isDeleted: false },
      opts,
    ),
    EnterpriseKey.countDocuments(
      { "history.toUserId": userId, isDeleted: false },
      opts,
    ),
  ]);

  inv.totalKeys = totalKeys;
  inv.availableKeys = availableKeys;
  inv.activatedKeys = activatedKeys;
  inv.expiredKeys = expiredKeys;
  inv.lockedKeys = lockedKeys;
  inv.transferredKeys = transferredOut;
  inv.receivedKeys = receivedKeys;
  inv.usedKeys = activatedKeys + lockedKeys;

  await inv.save(opts);
  return inv;
};

// Owned-key counts only. Skips history scans so a large transfer stays fast.
const syncOwnedInventory = async (userId, session) => {
  const opts = session ? { session } : {};
  const inv = await ensureInventory(userId, session);
  const baseFilter = { currentOwnerId: userId, isDeleted: false };
  const availableStatuses = ["Generated", "Allocated", "Transferred", "Assigned", "Received"];

  const [totalKeys, availableKeys, activatedKeys, expiredKeys, lockedKeys] =
    await Promise.all([
      EnterpriseKey.countDocuments(baseFilter, opts),
      EnterpriseKey.countDocuments(
        { ...baseFilter, status: { $in: availableStatuses } },
        opts,
      ),
      EnterpriseKey.countDocuments({ ...baseFilter, status: "Activated" }, opts),
      EnterpriseKey.countDocuments({ ...baseFilter, status: "Expired" }, opts),
      EnterpriseKey.countDocuments({ ...baseFilter, status: "Locked" }, opts),
    ]);

  inv.totalKeys = totalKeys;
  inv.availableKeys = availableKeys;
  inv.activatedKeys = activatedKeys;
  inv.expiredKeys = expiredKeys;
  inv.lockedKeys = lockedKeys;
  inv.usedKeys = activatedKeys + lockedKeys;
  await inv.save(opts);
  return inv;
};

const getGlobalKpis = async () => {
  const [
    totalKeys,
    availableKeys,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    stockists,
    distributors,
    dealers,
    users,
  ] = await Promise.all([
    EnterpriseKey.countDocuments({ isDeleted: false }),
    EnterpriseKey.countDocuments({
      isDeleted: false,
      status: { $in: ["Generated", "Allocated", "Transferred", "Assigned"] },
    }),
    EnterpriseKey.countDocuments({ isDeleted: false, status: "Activated" }),
    EnterpriseKey.countDocuments({ isDeleted: false, status: "Expired" }),
    EnterpriseKey.countDocuments({ isDeleted: false, status: "Locked" }),
    User.countDocuments({ enterpriseRole: "stockist", isDeleted: false }),
    User.countDocuments({ enterpriseRole: "distributor", isDeleted: false }),
    User.countDocuments({ enterpriseRole: "dealer", isDeleted: false }),
    require("../models/Customer.model").countDocuments({ isDeleted: { $ne: true } }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyActivations = await EnterpriseKey.countDocuments({
    isDeleted: false,
    status: "Activated",
    activationDate: { $gte: monthStart },
  });

  const transferredKeys = totalKeys - availableKeys;

  return {
    totalKeys,
    availableKeys,
    transferredKeys,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    stockists,
    distributors,
    dealers,
    users,
    monthlyRevenue: monthlyActivations * 250,
    monthlyActivations,
  };
};

const OWNED_AVAILABLE_STATUSES = [
  "Generated",
  "Allocated",
  "Transferred",
  "Received",
  "Assigned",
];

const countOwnedKeys = async (userId) => {
  const baseFilter = { currentOwnerId: userId, isDeleted: false };
  const [
    myKeys,
    myAvailable,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    givenAway,
  ] = await Promise.all([
    EnterpriseKey.countDocuments(baseFilter),
    EnterpriseKey.countDocuments({
      ...baseFilter,
      status: { $in: OWNED_AVAILABLE_STATUSES },
    }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Activated" }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Expired" }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Locked" }),
    EnterpriseKey.countDocuments({
      isDeleted: false,
      currentOwnerId: { $ne: userId },
      "history.fromUserId": userId,
    }),
  ]);
  return { myKeys, myAvailable, activatedKeys, expiredKeys, lockedKeys, givenAway };
};

// Every balance card uses the logged-in user's own keys.
// Network totals stay on network* so a transfer only changes the sender and receiver.
const withOwnWallet = async (actor, kpis) => {
  if (!actor?._id) return kpis;
  const own = await countOwnedKeys(actor._id);
  return {
    ...kpis,
    networkKeys: kpis.totalKeys,
    networkAvailable: kpis.availableKeys,
    networkTransferred: kpis.transferredKeys,
    networkActivated: kpis.activatedKeys,
    networkStockists: kpis.stockists ?? 0,
    networkDistributors: kpis.distributors ?? 0,
    networkDealers: kpis.dealers ?? 0,
    stockistCount: kpis.stockists ?? 0,
    distributorCount: kpis.distributors ?? 0,
    dealerCount: kpis.dealers ?? 0,
    userCount: kpis.users ?? 0,
    myKeys: own.myKeys,
    myAvailable: own.myAvailable,
    totalKeys: own.myKeys,
    availableKeys: own.myAvailable,
    transferredKeys: own.givenAway,
    activatedKeys: own.activatedKeys,
    expiredKeys: own.expiredKeys,
    lockedKeys: own.lockedKeys,
  };
};

const getScopedKpis = async (actor) => {
  if (!actor || actor.enterpriseRole === "super_admin") {
    return withOwnWallet(actor, await getGlobalKpis());
  }

  const ownerIds = [actor._id];
  if (actor.enterpriseRole !== "dealer") {
    const descendants = await getDescendantIds(actor._id);
    ownerIds.push(...descendants.map(id => new mongoose.Types.ObjectId(id)));
  }

  const baseFilter = { currentOwnerId: { $in: ownerIds }, isDeleted: false };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalKeys,
    availableKeys,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    monthlyActivations,
    distributors,
    dealers,
    users,
  ] = await Promise.all([
    EnterpriseKey.countDocuments(baseFilter),
    EnterpriseKey.countDocuments({
      ...baseFilter,
      status: { $in: ["Generated", "Allocated", "Transferred", "Assigned"] },
    }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Activated" }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Expired" }),
    EnterpriseKey.countDocuments({ ...baseFilter, status: "Locked" }),
    EnterpriseKey.countDocuments({
      ...baseFilter,
      status: "Activated",
      activationDate: { $gte: monthStart },
    }),
    User.countDocuments({
      parentId: actor._id,
      enterpriseRole: "distributor",
      isDeleted: false,
    }),
    User.countDocuments({
      parentId: { $in: ownerIds },
      enterpriseRole: "dealer",
      isDeleted: false,
    }),
    require("../models/Customer.model").countDocuments({
      createdBy: { $in: ownerIds },
      isDeleted: { $ne: true },
    }),
  ]);

  return withOwnWallet(actor, {
    totalKeys,
    availableKeys,
    transferredKeys: totalKeys - availableKeys,
    activatedKeys,
    expiredKeys,
    lockedKeys,
    stockists: actor.enterpriseRole === "stockist" ? 1 : 0,
    distributors,
    dealers,
    users,
    monthlyRevenue: monthlyActivations * 250,
    monthlyActivations,
  });
};

module.exports = {
  ensureInventory,
  recalculateInventory,
  syncOwnedInventory,
  getGlobalKpis,
  getScopedKpis,
};
