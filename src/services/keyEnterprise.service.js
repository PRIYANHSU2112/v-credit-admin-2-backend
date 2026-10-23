const mongoose = require("mongoose");
const User = require("../models/UserModel");
const EnterpriseKey = require("../models/EnterpriseKey.model");
const KeyTransfer = require("../models/KeyTransfer.model");
const { generateKeyNumber, generateBatchId } = require("../utils/keyGenerator");
const { recalculateInventory, syncOwnedInventory } = require("./inventory.service");
const KeyInventory = require("../models/KeyInventory.model");
const { createAuditLog } = require("./audit.service");

const ROLE_HIERARCHY = {
  super_admin: ["stockist", "distributor", "dealer"],
  stockist: ["distributor", "dealer"],
  distributor: ["dealer"],
  dealer: [],
};

const canManageRole = (actorRole, targetRole) =>
  ROLE_HIERARCHY[actorRole]?.includes(targetRole) ?? false;

const { getDescendantIds } = require("./hierarchyTree.service");

const allocateKeyNumbers = async (quantity, session) => {
  const used = new Set();
  const numbers = [];

  const takeFresh = () => {
    let keyNumber;
    let spins = 0;
    do {
      keyNumber = generateKeyNumber();
      if (++spins > 100) {
        throw new Error("Unable to allocate a unique key number");
      }
    } while (used.has(keyNumber));
    used.add(keyNumber);
    return keyNumber;
  };

  while (numbers.length < quantity) {
    numbers.push(takeFresh());
  }

  for (let round = 0; round < 8; round++) {
    const existing = await EnterpriseKey.find({ keyNumber: { $in: numbers } })
      .select("keyNumber")
      .session(session)
      .lean();
    if (!existing.length) return numbers;

    const taken = new Set(existing.map((doc) => doc.keyNumber));
    for (let i = 0; i < numbers.length; i++) {
      if (!taken.has(numbers[i])) continue;
      used.delete(numbers[i]);
      numbers[i] = takeFresh();
    }
  }

  const leftover = await EnterpriseKey.find({ keyNumber: { $in: numbers } })
    .select("keyNumber")
    .session(session)
    .lean();
  if (!leftover.length) return numbers;

  throw new Error("Unable to allocate unique key numbers");
};

const generateKeysOnce = async ({
  quantity,
  ownerId,
  performedBy,
  keyType = "standard",
  skipUserBalanceUpdate = false,
  req,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const batchId = generateBatchId();
    const keyNumbers = await allocateKeyNumbers(quantity, session);
    const keys = keyNumbers.map((keyNumber) => ({
      keyNumber,
      keyType,
      batchId,
      currentOwnerId: ownerId,
      originalOwnerId: ownerId,
      status: "Generated",
      history: [
        {
          action: "generated",
          toUserId: ownerId,
          performedBy,
          note: `Batch ${batchId}`,
        },
      ],
    }));

    const created = await EnterpriseKey.insertMany(keys, { session });

    const inv = await syncOwnedInventory(ownerId, session);

    const owner = await User.findById(ownerId).session(session);
    if (owner && !skipUserBalanceUpdate) {
      owner.keys = inv.totalKeys;
      await owner.save({ session });
    }

    await session.commitTransaction();

    await createAuditLog({
      action: `Generated ${quantity} keys`,
      userId: performedBy,
      role: "Super Admin",
      target: `Batch #${batchId}`,
      severity: "info",
      req,
    });

    return { batchId, keys: created, count: created.length };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const generateKeys = async (args) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await generateKeysOnce(args);
    } catch (err) {
      lastError = err;
      if (err?.code !== 11000) throw err;
    }
  }
  throw lastError;
};

const TRANSFERABLE_STATUSES = ["Generated", "Allocated", "Transferred", "Assigned"];

const moveKeyOwnership = async ({
  keyIds,
  fromUserId,
  toUserId,
  performedBy,
  note,
  action,
  session,
}) => {
  if (!keyIds.length) return;
  await EnterpriseKey.updateMany(
    { _id: { $in: keyIds } },
    {
      $set: { currentOwnerId: toUserId, status: "Transferred" },
      $push: {
        history: {
          action,
          fromUserId,
          toUserId,
          performedBy,
          note,
          at: new Date(),
        },
      },
    },
    { session },
  );
};

const transferKeys = async ({
  fromUserId,
  toUserId,
  quantity,
  performedBy,
  note,
  req,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transferableFilter = {
      currentOwnerId: fromUserId,
      isDeleted: false,
      status: { $in: TRANSFERABLE_STATUSES },
    };
    const availableCount = await EnterpriseKey.countDocuments(transferableFilter).session(
      session,
    );
    if (availableCount < quantity) {
      throw new Error(`Insufficient keys. Available: ${availableCount}`);
    }

    const keys = await EnterpriseKey.find(transferableFilter)
      .select("_id")
      .limit(quantity)
      .session(session)
      .lean();

    if (keys.length < quantity) {
      throw new Error(`Only ${keys.length} keys available for transfer`);
    }

    const batchId = generateBatchId();
    const keyIds = keys.map((k) => k._id);

    await moveKeyOwnership({
      keyIds,
      fromUserId,
      toUserId,
      performedBy,
      note: note || `Transfer batch ${batchId}`,
      action: "transferred",
      session,
    });

    await KeyTransfer.create(
      [
        {
          fromUserId,
          toUserId,
          quantity: keys.length,
          keyIds,
          batchId,
          status: "Completed",
          performedBy,
          note,
        },
      ],
      { session },
    );

    const [fromUser, toUser, fromInv, toInv] = await Promise.all([
      User.findById(fromUserId).select("name enterpriseRole").session(session),
      User.findById(toUserId).select("name").session(session),
      syncOwnedInventory(fromUserId, session),
      syncOwnedInventory(toUserId, session),
    ]);
    await User.updateOne({ _id: fromUserId }, { $set: { keys: fromInv.totalKeys } }, { session });
    await User.updateOne({ _id: toUserId }, { $set: { keys: toInv.totalKeys } }, { session });
    await KeyInventory.updateOne(
      { userId: fromUserId },
      { $inc: { transferredKeys: keys.length } },
      { session },
    );
    await KeyInventory.updateOne(
      { userId: toUserId },
      { $inc: { receivedKeys: keys.length } },
      { session },
    );

    await session.commitTransaction();

    const fromName = fromUser?.name || "Unknown";
    const toName = toUser?.name || "Unknown";

    await createAuditLog({
      action: `Transferred ${keys.length} keys`,
      userId: performedBy,
      userName: fromName,
      role: fromUser?.enterpriseRole || "admin",
      target: toName,
      severity: "info",
      req,
    });

    return { batchId, quantity: keys.length, keyIds };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Reclaim (take back) un-used keys from a downstream user back to the actor.
 * Only keys that have NOT been assigned/activated to a customer can be reclaimed
 * (Generated / Allocated / Transferred / Received). Activated or Assigned keys are
 * in use by a customer/loan and are left untouched.
 *
 * Authorization: super_admin can reclaim from anyone; others can only reclaim from
 * users in their own downstream hierarchy.
 */
const reclaimKeys = async ({
  fromUserId,
  toUserId,
  quantity,
  actor,
  performedBy,
  note,
  req,
}) => {
  if (!fromUserId || !quantity || quantity < 1) {
    throw new Error("fromUserId and a positive quantity are required");
  }
  if (String(fromUserId) === String(toUserId)) {
    throw new Error("Cannot reclaim keys from yourself");
  }

  // Authorization check
  const isSuperAdmin =
    actor?.enterpriseRole === "super_admin" || actor?.role === "admin";
  if (!isSuperAdmin) {
    const descendants = await getDescendantIds(actor._id);
    if (!descendants.map(String).includes(String(fromUserId))) {
      throw new Error("You can only reclaim keys from users in your hierarchy");
    }
  }

  const RECLAIMABLE = ["Generated", "Allocated", "Transferred", "Received"];

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const keys = await EnterpriseKey.find({
      currentOwnerId: fromUserId,
      isDeleted: false,
      status: { $in: RECLAIMABLE },
      assignedToCustomerId: { $in: [null, undefined] },
    })
      .select("_id")
      .limit(quantity)
      .session(session)
      .lean();

    if (keys.length === 0) {
      throw new Error("No reclaimable (un-used) keys available for this user");
    }

    const batchId = generateBatchId();
    const keyIds = keys.map((k) => k._id);

    await moveKeyOwnership({
      keyIds,
      fromUserId,
      toUserId,
      performedBy,
      note: note || `Reclaimed batch ${batchId}`,
      action: "reclaimed",
      session,
    });

    await KeyTransfer.create(
      [
        {
          fromUserId,
          toUserId,
          quantity: keys.length,
          keyIds,
          batchId,
          status: "Reversed",
          performedBy,
          note: note || "Key reclaim",
        },
      ],
      { session },
    );

    const [fromUser, toUser, fromInv, toInv] = await Promise.all([
      User.findById(fromUserId).select("name").session(session),
      User.findById(toUserId).select("name enterpriseRole").session(session),
      syncOwnedInventory(fromUserId, session),
      syncOwnedInventory(toUserId, session),
    ]);
    await User.updateOne({ _id: fromUserId }, { $set: { keys: fromInv.totalKeys } }, { session });
    await User.updateOne({ _id: toUserId }, { $set: { keys: toInv.totalKeys } }, { session });
    await KeyInventory.updateOne(
      { userId: toUserId },
      { $inc: { transferredKeys: keys.length } },
      { session },
    );
    await KeyInventory.updateOne(
      { userId: fromUserId },
      { $inc: { receivedKeys: keys.length } },
      { session },
    );

    await session.commitTransaction();

    await createAuditLog({
      action: `Reclaimed ${keys.length} keys`,
      userId: performedBy,
      userName: toUser?.name,
      role: actor?.enterpriseRole || "admin",
      target: fromUser?.name || String(fromUserId),
      severity: "warning",
      req,
    });

    // Notify the user the keys were taken back from.
    try {
      const { notify } = require("./mobile/notify.service");
      await notify({
        userId: fromUserId,
        title: "Keys reclaimed",
        body: `${keys.length} key(s) were reclaimed by ${toUser?.name || "your parent"}.`,
        data: { type: "KEYS_RECLAIMED", quantity: keys.length },
      });
    } catch (e) {
      /* non-fatal */
    }

    return { batchId, quantity: keys.length, keyIds };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const activateKey = async ({
  keyNumber,
  customerId,
  loanId,
  imei,
  performedBy,
  req,
}) => {
  const key = await EnterpriseKey.findOne({ keyNumber, isDeleted: false });
  if (!key) throw new Error("Key not found");
  if (key.status === "Activated") throw new Error("Key already activated");

  key.status = "Activated";
  key.activationDate = new Date();
  key.activatedForCustomerId = customerId;
  key.activatedForLoanId = loanId;
  key.imei = imei;
  key.history.push({
    action: "activated",
    performedBy,
    note: imei ? `IMEI ${imei}` : "Customer activation",
  });
  await key.save();

  if (key.currentOwnerId) {
    await recalculateInventory(key.currentOwnerId);
    const owner = await User.findById(key.currentOwnerId);
    if (owner) {
      owner.keys = Math.max(0, (owner.keys || 0) - 1);
      await owner.save();
    }
  }

  await createAuditLog({
    action: "Activated key for customer",
    userId: performedBy,
    target: imei || keyNumber,
    severity: "info",
    req,
  });

  return key;
};

module.exports = {
  ROLE_HIERARCHY,
  canManageRole,
  getDescendantIds,
  generateKeys,
  transferKeys,
  reclaimKeys,
  activateKey,
};
