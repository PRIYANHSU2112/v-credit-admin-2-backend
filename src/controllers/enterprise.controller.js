const mongoose = require("mongoose");
const User = require("../models/UserModel");
const EnterpriseKey = require("../models/EnterpriseKey.model");
const KeyTransfer = require("../models/KeyTransfer.model");
const AuditLog = require("../models/AuditLog.model");
const Customer = require("../models/Customer.model");
const Device = require("../models/Device.model");
const Address = require("../models/CustomerAddress.model");
const Loan = require("../models/CustomerLoan.model");
const PlatformSetting = require("../models/PlatformSetting.model");
const { getGlobalKpis, getScopedKpis, recalculateInventory } = require("../services/inventory.service");
const {
  generateKeys,
  transferKeys,
  reclaimKeys,
  activateKey,
} = require("../services/keyEnterprise.service");
const { getDescendantIds, getScopedOwnerIds } = require("../services/hierarchyTree.service");
const {
  listByRole,
  createHierarchyUser,
  formatUserRow,
  resetUserPassword,
} = require("../services/hierarchy.service");
const { timeAgo } = require("../services/audit.service");

// ─── Dashboard ───────────────────────────────────────────────

const getDashboard = async (req, res) => {
  try {
    const actor = req.enterpriseUser;
    const kpis = await getScopedKpis(actor);
    const ownerScope = await getScopedOwnerIds(actor);

    const keyFilter = { isDeleted: false };
    if (ownerScope) keyFilter.currentOwnerId = { $in: ownerScope };

    const recentKeys = await EnterpriseKey.find(keyFilter)
      .sort({ updatedAt: -1 })
      .limit(14)
      .populate("currentOwnerId", "name");

    const activationTrend = await buildActivationTrend(ownerScope);
    const keyStatusBreakdown = await buildKeyStatusBreakdown(ownerScope);

    const auditFilter = { isDeleted: false };
    if (ownerScope) {
      const scopeIds = ownerScope.map((id) => id.toString());
      auditFilter.userId = { $in: scopeIds };
    }

    const auditLogs = await AuditLog.find(auditFilter)
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const notifications = await buildNotifications(ownerScope);

    return res.json({
      success: true,
      data: {
        kpis,
        activationTrend,
        keyStatusBreakdown,
        recentKeys: recentKeys.map(k => ({
          key: k.keyNumber,
          owner: k.currentOwnerId?.name || "—",
          status: k.status,
          updated: timeAgo(k.updatedAt),
        })),
        auditLogs: auditLogs.map(a => ({
          time: timeAgo(a.createdAt),
          actor: a.userName || "System",
          role: a.role || "System",
          action: a.action,
          target: a.target || "—",
          severity: a.severity,
        })),
        notifications,
        stockists: (await listByRole({ role: "stockist", actor, limit: 8 })).data,
        distributors: (await listByRole({ role: "distributor", actor, limit: 8 })).data,
        dealers: (await listByRole({ role: "dealer", actor, limit: 8 })).data,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

async function buildActivationTrend(ownerScope) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const trend = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const activationFilter = {
      status: "Activated",
      activationDate: { $gte: d, $lt: next },
      isDeleted: false,
    };
    if (ownerScope) activationFilter.currentOwnerId = { $in: ownerScope };

    const transferFilter = { createdAt: { $gte: d, $lt: next } };
    if (ownerScope) {
      transferFilter.$or = [
        { fromUserId: { $in: ownerScope } },
        { toUserId: { $in: ownerScope } },
      ];
    }

    const [activations, transfers] = await Promise.all([
      EnterpriseKey.countDocuments(activationFilter),
      KeyTransfer.countDocuments(transferFilter),
    ]);
    trend.push({
      month: months[d.getMonth()],
      activations,
      transfers,
      revenue: activations * 250,
    });
  }
  return trend;
}

async function buildKeyStatusBreakdown(ownerScope) {
  const statuses = ["Activated", "Generated", "Transferred", "Expired", "Locked"];
  const colors = [
    "var(--color-chart-2)",
    "var(--color-chart-1)",
    "var(--color-chart-5)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
  ];
  const result = [];
  for (let i = 0; i < statuses.length; i++) {
    const filter = { status: statuses[i], isDeleted: false };
    if (ownerScope) filter.currentOwnerId = { $in: ownerScope };
    const value = await EnterpriseKey.countDocuments(filter);
    if (value > 0) result.push({ name: statuses[i], value, color: colors[i] });
  }
  return result;
}

async function buildNotifications(ownerScope) {
  const userFilter = {
    enterpriseRole: { $in: ["distributor", "dealer"] },
    keys: { $lte: 120 },
    isDeleted: false,
  };
  if (ownerScope) userFilter._id = { $in: ownerScope };

  const lowInventory = await User.find(userFilter).limit(3).select("name keys updatedAt");

  const transferFilter = {};
  if (ownerScope) {
    transferFilter.$or = [
      { fromUserId: { $in: ownerScope } },
      { toUserId: { $in: ownerScope } },
    ];
  }

  const recentTransfers = await KeyTransfer.find(transferFilter)
    .sort({ createdAt: -1 })
    .limit(2)
    .populate("fromUserId toUserId", "name");

  const notifs = lowInventory.map(u => ({
    title: "Low inventory",
    desc: `${u.name} has only ${u.keys} keys left.`,
    time: timeAgo(u.updatedAt),
    type: "warning",
  }));

  recentTransfers.forEach(t => {
    notifs.push({
      title: "New transfer",
      desc: `${t.fromUserId?.name || "?"} → ${t.toUserId?.name || "?"} (${t.quantity} keys)`,
      time: timeAgo(t.createdAt),
      type: "info",
    });
  });

  return notifs.slice(0, 6);
}

// ─── Keys ────────────────────────────────────────────────────

const listKeys = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { keyNumber: { $regex: search, $options: "i" } },
        { batchId: { $regex: search, $options: "i" } },
      ];
    }

    const actor = req.enterpriseUser;
    if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      filter.currentOwnerId = {
        $in: [actor._id, ...descendants.map(id => new mongoose.Types.ObjectId(id))],
      };
    }

    const [keys, total] = await Promise.all([
      EnterpriseKey.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("currentOwnerId", "name"),
      EnterpriseKey.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: keys.map(k => ({
        key: k.keyNumber,
        batch: k.batchId,
        owner: k.currentOwnerId?.name || "—",
        status: k.status,
        createdAt: k.createdAt?.toISOString().slice(0, 10),
        updated: timeAgo(k.updatedAt),
        _id: k._id,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const generateKeyBatch = async (req, res) => {
  try {
    const quantity = parseInt(req.body.quantity) || parseInt(req.body.count) || 0;
    if (quantity < 1 || quantity > 10000) {
      return res.status(400).json({ success: false, message: "Quantity must be 1-10000" });
    }

    const ownerId = req.body.ownerId || req.userId;
    const result = await generateKeys({
      quantity,
      ownerId,
      performedBy: req.userId,
      keyType: req.body.keyType,
      req,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const transferKeyBatch = async (req, res) => {
  try {
    const { toUserId, quantity, note } = req.body;
    if (!toUserId || !quantity) {
      return res.status(400).json({ success: false, message: "toUserId and quantity required" });
    }

    const result = await transferKeys({
      fromUserId: req.userId,
      toUserId,
      quantity: parseInt(quantity),
      performedBy: req.userId,
      note,
      req,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const reclaimKeyBatch = async (req, res) => {
  try {
    const { fromUserId, quantity, toUserId, note } = req.body;
    if (!fromUserId || !quantity) {
      return res
        .status(400)
        .json({ success: false, message: "fromUserId and quantity required" });
    }

    const result = await reclaimKeys({
      fromUserId,
      // Default: reclaim into the actor's own account.
      toUserId: toUserId || req.userId,
      quantity: parseInt(quantity),
      actor: req.enterpriseUser,
      performedBy: req.userId,
      note,
      req,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const activateKeyForCustomer = async (req, res) => {
  try {
    const key = await activateKey({
      keyNumber: req.body.keyNumber,
      customerId: req.body.customerId,
      loanId: req.body.loanId,
      imei: req.body.imei,
      performedBy: req.userId,
      req,
    });
    return res.json({ success: true, data: key });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Hierarchy CRUD ────────────────────────────────────────────

const getStockists = async (req, res) => {
  try {
    const result = await listByRole({
      role: "stockist",
      actor: req.enterpriseUser,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      search: req.query.search,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDistributors = async (req, res) => {
  try {
    const result = await listByRole({
      role: "distributor",
      actor: req.enterpriseUser,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      search: req.query.search,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDealers = async (req, res) => {
  try {
    const result = await listByRole({
      role: "dealer",
      actor: req.enterpriseUser,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      search: req.query.search,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createStockist = async (req, res) => {
  try {
    const data = await createHierarchyUser({
      actor: req.enterpriseUser,
      role: "stockist",
      data: req.body,
      req,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const createDistributor = async (req, res) => {
  try {
    const data = await createHierarchyUser({
      actor: req.enterpriseUser,
      role: "distributor",
      data: req.body,
      req,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const createDealer = async (req, res) => {
  try {
    const data = await createHierarchyUser({
      actor: req.enterpriseUser,
      role: "dealer",
      data: req.body,
      req,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const resetEnterpriseUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const data = await resetUserPassword({
      actor: req.enterpriseUser,
      userId: req.params.userId,
      password,
      req,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Inventory ─────────────────────────────────────────────────

const getInventory = async (req, res) => {
  try {
    const kpis = await getScopedKpis(req.enterpriseUser);
    const actor = req.enterpriseUser;

    let userFilter = { isDeleted: false, enterpriseRole: "stockist" };
    if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      userFilter._id = { $in: [actor._id, ...descendants] };
    }

    const stockists = await User.find(userFilter).limit(24);
    const stockistRows = await Promise.all(stockists.map(u => formatUserRow(u)));

    return res.json({
      success: true,
      data: { kpis, stockists: stockistRows },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Audit ─────────────────────────────────────────────────────

const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actor = req.enterpriseUser;
    const ownerScope = await getScopedOwnerIds(actor);

    const filter = { isDeleted: false };
    if (ownerScope) {
      filter.userId = { $in: ownerScope.map((id) => id.toString()) };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: logs.map(a => ({
        time: timeAgo(a.createdAt),
        actor: a.userName || "System",
        role: a.role || "System",
        action: a.action,
        target: a.target || "—",
        severity: a.severity,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── End Users (Customers) ───────────────────────────────────

const ACTIVATED_KEY_STATUSES = ["Activated", "Running", "Expired", "Locked"];
const ASSIGNED_KEY_STATUSES = ["Assigned", ...ACTIVATED_KEY_STATUSES];

function formatDeviceLabel({ device, loan, key }) {
  if (device?.brand || device?.deviceModel) {
    return [device.brand, device.deviceModel].filter(Boolean).join(" ").trim();
  }
  if (loan?.mobileBrand || loan?.mobileModel) {
    return [loan.mobileBrand, loan.mobileModel].filter(Boolean).join(" ").trim();
  }
  const imei = device?.imei1 || key?.imei || loan?.imeiNumber1;
  if (imei) return `IMEI •••${String(imei).slice(-4)}`;
  return "—";
}

function resolveEndUserStatus({ customer, key, device, loan }) {
  if (device?.isBlacklisted) return "Blocked";
  if (key && ACTIVATED_KEY_STATUSES.includes(key.status)) return "Active";
  if (device?.status === "ACTIVATED") return "Active";
  if (
    key?.status === "Assigned" &&
    loan &&
    ["APPROVED", "ACTIVE"].includes(loan.loanStatus)
  ) {
    return "Active";
  }
  if (customer.isVerified && (key || loan)) return "Pending";
  return "Pending";
}

const getEndUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const actor = req.enterpriseUser;

    const filter = { isDeleted: { $ne: true } };
    if (actor.enterpriseRole === "dealer") {
      filter.createdBy = actor._id;
    } else if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      filter.createdBy = {
        $in: [actor._id, ...descendants.map(id => new mongoose.Types.ObjectId(id))],
      };
    }

    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      filter.$or = [
        { customerName: { $regex: q, $options: "i" } },
        { customerMobileNumber: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    if (req.query.fromDate || req.query.toDate) {
      filter.createdAt = filter.createdAt || {};
      if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) {
        const toD = new Date(req.query.toDate);
        toD.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toD;
      }
    }

    if (req.query.dealerId && req.query.dealerId !== "all" && mongoose.Types.ObjectId.isValid(req.query.dealerId)) {
      filter.createdBy = new mongoose.Types.ObjectId(req.query.dealerId);
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ]);

    if (!customers.length) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 1,
          totalItems: total,
        },
      });
    }

    const customerIds = customers.map(c => c._id);
    const dealerIds = [
      ...new Set(customers.map(c => c.createdBy?.toString()).filter(Boolean)),
    ];

    const [keys, devices, loans, addresses, dealers] = await Promise.all([
      EnterpriseKey.find({
        isDeleted: { $ne: true },
        $or: [
          { assignedToCustomerId: { $in: customerIds } },
          { activatedForCustomerId: { $in: customerIds } },
        ],
        status: { $in: ASSIGNED_KEY_STATUSES },
      })
        .sort({ activationDate: -1, assignedAt: -1, updatedAt: -1 })
        .lean(),
      Device.find({
        $or: [
          { customerId: { $in: customerIds } },
        ],
      })
        .sort({ activatedAt: -1, updatedAt: -1 })
        .lean(),
      Loan.find({ customerId: { $in: customerIds } })
        .sort({ createdAt: -1 })
        .select("customerId mobileBrand mobileModel imeiNumber1 imeiNumber2 loanStatus createdAt")
        .lean(),
      Address.find({ customerId: { $in: customerIds } })
        .select("customerId customerCity customerState customerAddress")
        .lean(),
      User.find({ _id: { $in: dealerIds } }).select("name").lean(),
    ]);

    const dealerMap = Object.fromEntries(dealers.map(d => [d._id.toString(), d.name]));
    const addressMap = Object.fromEntries(addresses.map(a => [a.customerId.toString(), a]));
    const loanMap = {};
    for (const loan of loans) {
      const id = loan.customerId.toString();
      if (!loanMap[id]) loanMap[id] = loan;
    }

    const keyMap = {};
    for (const key of keys) {
      for (const cid of [key.activatedForCustomerId, key.assignedToCustomerId]) {
        if (!cid) continue;
        const id = cid.toString();
        if (!keyMap[id]) keyMap[id] = key;
      }
    }

    const deviceMap = {};
    for (const device of devices) {
      const id = device.customerId?.toString();
      if (id && !deviceMap[id]) deviceMap[id] = device;
    }

    const data = customers.map((c, i) => {
      const cid = c._id.toString();
      const key = keyMap[cid] || null;
      const device = deviceMap[cid] || null;
      const loan = loanMap[cid] || null;
      const addr = addressMap[cid];

      const city =
        addr?.customerCity ||
        addr?.customerState ||
        (c.address ? c.address.split(",")[0]?.trim() : null) ||
        "—";

      const activatedAt = key?.activationDate
        ? key.activationDate.toISOString().slice(0, 10)
        : key?.assignedAt
          ? key.assignedAt.toISOString().slice(0, 10)
          : device?.activatedAt
            ? device.activatedAt.toISOString().slice(0, 10)
            : "—";

      return {
        id: `USR-${String(40001 + skip + i).padStart(5, "0")}`,
        name: c.customerName || "—",
        phone: c.customerMobileNumber || "—",
        dealer: dealerMap[c.createdBy?.toString()] || "—",
        city,
        keyId: key?.keyNumber || "—",
        keyStatus: key?.status || "—",
        device: formatDeviceLabel({ device, loan, key }),
        imei: device?.imei1 || key?.imei || loan?.imeiNumber1 || "—",
        activatedAt,
        status: resolveEndUserStatus({ customer: c, key, device, loan }),
        isLocked: device ? Boolean(device.isLocked) : false,
        lockStatus: (device?.lockStatus || (device?.isLocked ? "LOCKED" : "UNLOCKED")).toLowerCase(),
        loanStatus: loan?.loanStatus || "—",
        _id: c._id,
      };
    });

    return res.json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Territories ───────────────────────────────────────────────

const getTerritories = async (req, res) => {
  try {
    const territories = await User.aggregate([
      { $match: { enterpriseRole: "stockist", isDeleted: false, territory: { $ne: null } } },
      {
        $group: {
          _id: "$territory",
          stockists: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const data = await Promise.all(
      territories.map(async (t, i) => {
        const stockistIds = await User.find({
          territory: t._id,
          enterpriseRole: "stockist",
          isDeleted: false,
        }).select("_id");
        const ids = stockistIds.map(s => s._id);

        const [distributors, dealers, keys, activations] = await Promise.all([
          User.countDocuments({ parentId: { $in: ids }, enterpriseRole: "distributor", isDeleted: false }),
          User.countDocuments({
            parentId: {
              $in: await User.find({ parentId: { $in: ids }, enterpriseRole: "distributor" }).distinct("_id"),
            },
            enterpriseRole: "dealer",
            isDeleted: false,
          }),
          EnterpriseKey.countDocuments({ currentOwnerId: { $in: ids }, isDeleted: false }),
          EnterpriseKey.countDocuments({ currentOwnerId: { $in: ids }, status: "Activated", isDeleted: false }),
        ]);

        return {
          id: `TER-${String(i + 1).padStart(3, "0")}`,
          name: t._id,
          state: t._id?.slice(0, 2)?.toUpperCase() || "—",
          stockists: t.stockists,
          distributors,
          dealers,
          keys,
          activations,
          revenue: activations * 250,
          status: "Active",
        };
      }),
    );

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Commissions (computed) ────────────────────────────────────

const getCommissions = async (req, res) => {
  try {
    const actor = req.enterpriseUser;
    let platform = await PlatformSetting.findOne();
    if (!platform) {
      platform = await PlatformSetting.create({});
    }

    const stockistRate = platform.stockistCommissionRate ?? 12;
    const distributorRate = platform.distributorCommissionRate ?? 8;
    const dealerRate = platform.dealerCommissionRate ?? 5;

    const tiers = [
      { role: "stockist", tier: "Stockist", rate: stockistRate, prefix: "COM-STK" },
      { role: "distributor", tier: "Distributor", rate: distributorRate, prefix: "COM-DST" },
      { role: "dealer", tier: "Dealer", rate: dealerRate, prefix: "COM-DLR" },
    ];

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const currentMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const data = [];
    for (const t of tiers) {
      let userFilter = { enterpriseRole: t.role, isDeleted: false };
      if (actor.enterpriseRole !== "super_admin") {
        const descendants = await getDescendantIds(actor._id);
        userFilter._id = { $in: [actor._id, ...descendants.map(id => new mongoose.Types.ObjectId(id))] };
      }

      const users = await User.find(userFilter).limit(50);
      for (let i = 0; i < users.length; i++) {
        const inv = await require("../models/KeyInventory.model").findOne({ userId: users[i]._id });
        const keysSold = inv?.activatedKeys ?? 0;
        const earned = keysSold * t.rate;
        data.push({
          id: `${t.prefix}-${users[i].entityCode || users[i]._id.toString().slice(-4)}`,
          entity: users[i].name,
          tier: t.tier,
          keysSold,
          rate: t.rate,
          earned,
          paid: 0,
          month: currentMonth,
          status: earned > 0 ? "Pending" : "—",
        });
      }
    }

    const commissionTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const [stkAct, dstAct, dlrAct] = await Promise.all([
        countActivationsForRole("stockist", d, next, actor),
        countActivationsForRole("distributor", d, next, actor),
        countActivationsForRole("dealer", d, next, actor),
      ]);
      commissionTrend.push({
        month: monthNames[d.getMonth()],
        stockist: stkAct * stockistRate,
        distributor: dstAct * distributorRate,
        dealer: dlrAct * dealerRate,
      });
    }

    return res.json({
      success: true,
      data: {
        commissions: data,
        commissionTrend,
        rates: {
          stockist: stockistRate,
          distributor: distributorRate,
          dealer: dealerRate,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateCommissionRates = async (req, res) => {
  try {
    const { stockist, distributor, dealer } = req.body || {};
    let platform = await PlatformSetting.findOne();
    if (!platform) {
      platform = new PlatformSetting();
    }

    if (stockist !== undefined && !isNaN(Number(stockist)) && Number(stockist) >= 0) {
      platform.stockistCommissionRate = Number(stockist);
    }
    if (distributor !== undefined && !isNaN(Number(distributor)) && Number(distributor) >= 0) {
      platform.distributorCommissionRate = Number(distributor);
    }
    if (dealer !== undefined && !isNaN(Number(dealer)) && Number(dealer) >= 0) {
      platform.dealerCommissionRate = Number(dealer);
    }

    await platform.save();

    return res.json({
      success: true,
      message: "Commission rates updated successfully",
      data: {
        stockist: platform.stockistCommissionRate,
        distributor: platform.distributorCommissionRate,
        dealer: platform.dealerCommissionRate,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

async function countActivationsForRole(role, from, to, actor) {
  const users = await User.find({ enterpriseRole: role, isDeleted: false }).select("_id");
  let ids = users.map(u => u._id);
  if (actor.enterpriseRole !== "super_admin") {
    const descendants = await getDescendantIds(actor._id);
    const allowed = new Set([actor._id.toString(), ...descendants]);
    ids = ids.filter(id => allowed.has(id.toString()));
  }
  if (!ids.length) return 0;
  return EnterpriseKey.countDocuments({
    currentOwnerId: { $in: ids },
    status: "Activated",
    activationDate: { $gte: from, $lt: to },
    isDeleted: false,
  });
}

const getAnalytics = async (req, res) => {
  try {
    const actor = req.enterpriseUser;
    const filter = { isDeleted: { $ne: true } };

    if (actor.enterpriseRole === "dealer") {
      filter.createdBy = actor._id;
    } else if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      filter.createdBy = {
        $in: [actor._id, ...descendants.map(id => new mongoose.Types.ObjectId(id))],
      };
    }

    const cityAgg = await Customer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ["$address", "Unknown"] },
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
      { $limit: 10 },
    ]);

    return res.json({
      success: true,
      data: {
        cities: cityAgg.map(c => ({
          city: c._id || "Unknown",
          value: c.value,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getSettings = async (req, res) => {
  try {
    const user = req.enterpriseUser;
    let [totalKeys, totalUsers, auditCount, platformSettings] = await Promise.all([
      EnterpriseKey.countDocuments({ isDeleted: false }),
      User.countDocuments({ isDeleted: false, enterpriseRole: { $ne: null } }),
      AuditLog.countDocuments({ isDeleted: false }),
      PlatformSetting.findOne(),
    ]);

    if (!platformSettings) {
      platformSettings = await PlatformSetting.create({});
    }

    return res.json({
      success: true,
      data: {
        profile: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.enterpriseRole,
          entityCode: user.entityCode,
          territory: user.territory,
          city: user.city,
        },
        platform: {
          keyPrice: platformSettings.keyPrice ?? 350,
          iphoneKeyPrice: platformSettings.iphoneKeyPrice ?? 600,
          stockistCommissionRate: platformSettings.stockistCommissionRate ?? 12,
          distributorCommissionRate: platformSettings.distributorCommissionRate ?? 8,
          dealerCommissionRate: platformSettings.dealerCommissionRate ?? 5,
          autoLockOnOverdue: platformSettings.autoLockOnOverdue ?? true,
          gracePeriodDays: platformSettings.gracePeriodDays ?? 3,
          smsGatewayActive: platformSettings.smsGatewayActive ?? true,
          whatsappAlerts: platformSettings.whatsappAlerts ?? true,
        },
        stats: {
          totalKeys,
          networkUsers: totalUsers,
          auditEvents: auditCount,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const user = req.enterpriseUser;
    const {
      name,
      phone,
      city,
      territory,
      keyPrice,
      iphoneKeyPrice,
      stockistCommissionRate,
      distributorCommissionRate,
      dealerCommissionRate,
      autoLockOnOverdue,
      gracePeriodDays,
      smsGatewayActive,
      whatsappAlerts,
    } = req.body || {};

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof city === "string") user.city = city.trim();
    if (typeof territory === "string") user.territory = territory.trim();

    await user.save();

    let platform = await PlatformSetting.findOne();
    if (!platform) {
      platform = new PlatformSetting();
    }

    if (keyPrice !== undefined && !isNaN(Number(keyPrice))) platform.keyPrice = Number(keyPrice);
    if (iphoneKeyPrice !== undefined && !isNaN(Number(iphoneKeyPrice))) platform.iphoneKeyPrice = Number(iphoneKeyPrice);
    if (stockistCommissionRate !== undefined && !isNaN(Number(stockistCommissionRate))) platform.stockistCommissionRate = Number(stockistCommissionRate);
    if (distributorCommissionRate !== undefined && !isNaN(Number(distributorCommissionRate))) platform.distributorCommissionRate = Number(distributorCommissionRate);
    if (dealerCommissionRate !== undefined && !isNaN(Number(dealerCommissionRate))) platform.dealerCommissionRate = Number(dealerCommissionRate);
    if (autoLockOnOverdue !== undefined) platform.autoLockOnOverdue = Boolean(autoLockOnOverdue);
    if (gracePeriodDays !== undefined && !isNaN(Number(gracePeriodDays))) platform.gracePeriodDays = Number(gracePeriodDays);
    if (smsGatewayActive !== undefined) platform.smsGatewayActive = Boolean(smsGatewayActive);
    if (whatsappAlerts !== undefined) platform.whatsappAlerts = Boolean(whatsappAlerts);

    await platform.save();

    return res.json({
      success: true,
      message: "Settings updated successfully",
      data: {
        profile: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.enterpriseRole,
          entityCode: user.entityCode,
          territory: user.territory,
          city: user.city,
        },
        platform: {
          keyPrice: platform.keyPrice,
          iphoneKeyPrice: platform.iphoneKeyPrice,
          stockistCommissionRate: platform.stockistCommissionRate,
          distributorCommissionRate: platform.distributorCommissionRate,
          dealerCommissionRate: platform.dealerCommissionRate,
          autoLockOnOverdue: platform.autoLockOnOverdue,
          gracePeriodDays: platform.gracePeriodDays,
          smsGatewayActive: platform.smsGatewayActive,
          whatsappAlerts: platform.whatsappAlerts,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getReports = async (req, res) => {
  try {
    const kpis = await getScopedKpis(req.enterpriseUser);
    const reports = [
      { id: "keys-ledger", title: "Key Ledger Export", description: "All keys with status and ownership", count: kpis.networkKeys ?? kpis.totalKeys },
      { id: "activations", title: "Activation Report", description: "Monthly activations by network", count: kpis.monthlyActivations },
      { id: "inventory", title: "Inventory Snapshot", description: "Available keys across hierarchy", count: kpis.networkAvailable ?? kpis.availableKeys },
      { id: "audit", title: "Audit Trail", description: "System audit events", count: null },
      { id: "commissions", title: "Commission Statement", description: "Earned vs paid commissions", count: null },
      { id: "users", title: "End Users Export", description: "Customer activation records", count: kpis.users },
    ];
    return res.json({ success: true, data: reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getTransferReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const actor = req.enterpriseUser;
    const { keyType, search, fromDate, toDate, type, partnerId } = req.query;

    const filter = { isDeleted: false };

    // Hierarchy scoping
    if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      const allowedScope = [actor._id, ...descendants];
      filter.$or = [
        { fromUserId: { $in: allowedScope } },
        { toUserId: { $in: allowedScope } },
      ];
    }

    // Filter by inbound/received vs outbound
    if (type === "received") {
      filter.toUserId = actor._id;
    } else if (type === "stockist_dist") {
      // Recipient is distributor
      const distUsers = await User.find({ enterpriseRole: "distributor", isDeleted: false }).select("_id");
      filter.toUserId = { $in: distUsers.map(u => u._id) };
    } else if (type === "dist_dealer") {
      // Recipient is dealer
      const dealerUsers = await User.find({ enterpriseRole: "dealer", isDeleted: false }).select("_id");
      filter.toUserId = { $in: dealerUsers.map(u => u._id) };
    }

    // Filter by specific partner if selected
    if (partnerId && partnerId !== "all") {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { fromUserId: partnerId },
          { toUserId: partnerId },
        ],
      });
    }

    // Filter by iPhone keyType
    if (keyType === "iphone") {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { batchId: { $regex: /^IPH/i } },
          { note: { $regex: /iphone/i } },
        ],
      });
    } else if (keyType === "regular") {
      filter.batchId = { $not: /^IPH/i };
    }

    // Date range
    if (fromDate || toDate) {
      filter.createdAt = filter.createdAt || {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim();
      const matchingUsers = await User.find({
        name: { $regex: q, $options: "i" },
        isDeleted: false,
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { batchId: { $regex: q, $options: "i" } },
          { note: { $regex: q, $options: "i" } },
          { fromUserId: { $in: userIds } },
          { toUserId: { $in: userIds } },
        ],
      });
    }

    const [transfers, total] = await Promise.all([
      KeyTransfer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("fromUserId", "name enterpriseRole phone city entityCode")
        .populate("toUserId", "name enterpriseRole phone city entityCode")
        .lean(),
      KeyTransfer.countDocuments(filter),
    ]);

    const formatted = transfers.map((t) => {
      const from = t.fromUserId || {};
      const to = t.toUserId || {};
      return {
        id: t._id.toString(),
        _id: t._id.toString(),
        transferId: t.batchId || `TR-${String(t._id).slice(-6).toUpperCase()}`,
        transactionDate: t.createdAt
          ? new Date(t.createdAt).toISOString().replace("T", " ").slice(0, 19)
          : "—",
        transferTo: to.name || "Recipient",
        toRole: to.enterpriseRole || "partner",
        toPhone: to.phone || "—",
        toCity: to.city || "—",
        toEntityCode: to.entityCode || "—",
        sendBy: from.name || "Sender",
        fromRole: from.enterpriseRole || "admin",
        fromPhone: from.phone || "—",
        receivedFrom: from.name || "Master Vault Root",
        receivedPhone: from.phone || "—",
        quantity: t.quantity || 0,
        keys: t.quantity || 0,
        status: t.status || "Completed",
        note: t.note || "Standard Key Dispatch",
        keyType: keyType || (t.batchId?.startsWith("IPH") ? "iphone" : "regular"),
      };
    });

    return res.json({
      success: true,
      data: formatted,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalItems: total,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getLowKeyReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const threshold = parseInt(req.query.threshold) || 10;
    const targetRole = req.query.role || "distributor";
    const actor = req.enterpriseUser;
    const { search, parentId } = req.query;

    const userFilter = { enterpriseRole: targetRole, isDeleted: false };

    if (actor.enterpriseRole !== "super_admin") {
      const descendants = await getDescendantIds(actor._id);
      userFilter._id = { $in: descendants };
    }

    if (parentId && parentId !== "all") {
      userFilter.parentId = parentId;
    }

    if (search && search.trim()) {
      userFilter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { phone: { $regex: search.trim(), $options: "i" } },
        { city: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const users = await User.find(userFilter).populate("parentId", "name phone entityCode").lean();
    const KeyInventoryModel = require("../models/KeyInventory.model");
    const userIds = users.map((u) => u._id);
    const inventories = await KeyInventoryModel.find({ userId: { $in: userIds } }).lean();
    const invMap = Object.fromEntries(inventories.map((inv) => [inv.userId.toString(), inv]));

    const lowKeyRows = [];
    for (const u of users) {
      const inv = invMap[u._id.toString()];
      const available = inv?.availableKeys ?? u.keys ?? 0;
      const total = inv?.totalKeys ?? u.keys ?? 0;
      const activations = inv?.activatedKeys ?? 0;
      if (available <= threshold) {
        lowKeyRows.push({
          id: u._id.toString(),
          _id: u._id.toString(),
          entityCode: u.entityCode || `ID-${u._id.toString().slice(-4)}`,
          name: u.name,
          agency: u.name,
          dealerShop: u.name,
          dealerName: u.name,
          phone: u.phone || "—",
          email: u.email || "—",
          city: u.city || "—",
          state: u.state || u.territory || "—",
          availableKeys: available,
          totalKeys: total,
          usedKeys: Math.max(0, total - available),
          activations,
          threshold,
          parentId: u.parentId?._id?.toString() || null,
          parentName: u.parentId?.name || (targetRole === "stockist" ? "Master Vault Admin" : "Direct Master"),
          stockist: targetRole === "stockist" ? u.name : (u.parentId?.name || "Direct Master"),
          distributor: targetRole === "dealer" ? (u.parentId?.name || "Direct Hub") : "—",
          status: available === 0 ? "Critical (0 Keys)" : "Low Warning",
          lastActive: u.updatedAt ? timeAgo(u.updatedAt) : "—",
          lastActivation: u.updatedAt ? timeAgo(u.updatedAt) : "—",
          lastBillingDate: u.updatedAt ? timeAgo(u.updatedAt) : "—",
        });
      }
    }

    const paginatedRows = lowKeyRows.slice(skip, skip + limit);

    return res.json({
      success: true,
      data: paginatedRows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(lowKeyRows.length / limit) || 1,
        totalItems: lowKeyRows.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const ownerScope = await getScopedOwnerIds(req.enterpriseUser);
    const notifications = await buildNotifications(ownerScope);
    return res.json({ success: true, data: notifications });
    
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Current session ───────────────────────────────────────────

const getMe = async (req, res) => {
  try {
    const user = req.enterpriseUser;
    let parentName = null;
    if (user.parentId) {
      const parentUser = await User.findById(user.parentId).select("name");
      if (parentUser) parentName = parentUser.name;
    }

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        enterpriseRole: req.enterpriseRole,
        parentId: user.parentId || null,
        parentName,
        keys: user.keys ?? 0,
        territory: user.territory,
        city: user.city,
        entityCode: user.entityCode,
        enterpriseStatus: user.enterpriseStatus,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Global Search ─────────────────────────────────────────────

const globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ success: true, data: { keys: [], users: [], customers: [] } });

    const ownerScope = await getScopedOwnerIds(req.enterpriseUser);

    const keyFilter = { keyNumber: { $regex: q, $options: "i" }, isDeleted: false };
    if (ownerScope) keyFilter.currentOwnerId = { $in: ownerScope };

    const userFilter = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { entityCode: { $regex: q, $options: "i" } },
      ],
      isDeleted: false,
    };
    // Non-global actors only see users within their own hierarchy.
    if (ownerScope) userFilter._id = { $in: ownerScope };

    const customerFilter = {
      $or: [
        { customerName: { $regex: q, $options: "i" } },
        { customerMobileNumber: { $regex: q, $options: "i" } },
      ],
    };
    if (ownerScope) customerFilter.createdBy = { $in: ownerScope };

    const [keys, users, customers] = await Promise.all([
      EnterpriseKey.find(keyFilter).limit(10),
      User.find(userFilter).limit(10),
      Customer.find(customerFilter).limit(10),
    ]);

    return res.json({
      success: true,
      data: {
        keys: keys.map(k => ({ type: "key", label: k.keyNumber, id: k._id })),
        users: users.map(u => ({ type: u.enterpriseRole || "user", label: u.name, id: u._id })),
        customers: customers.map(c => ({ type: "customer", label: c.customerName, id: c._id })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getDashboard,
  getMe,
  listKeys,
  generateKeyBatch,
  transferKeyBatch,
  reclaimKeyBatch,
  activateKeyForCustomer,
  getStockists,
  getDistributors,
  getDealers,
  createStockist,
  createDistributor,
  createDealer,
  resetEnterpriseUserPassword,
  getInventory,
  getAuditLogs,
  getEndUsers,
  getTerritories,
  getCommissions,
  updateCommissionRates,
  getAnalytics,
  getSettings,
  updateSettings,
  getReports,
  getTransferReports,
  getLowKeyReports,
  getNotifications,
  globalSearch,
};
