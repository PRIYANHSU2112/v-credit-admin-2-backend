const mongoose = require("mongoose");
const User = require("../models/UserModel");

/** BFS collect all descendant user ids under a parent (no circular imports). */
const getDescendantIds = async (userId) => {
  const ids = [];
  const queue = [userId.toString()];
  while (queue.length) {
    const current = queue.shift();
    const children = await User.find({
      parentId: current,
      isDeleted: false,
    }).select("_id");
    for (const child of children) {
      const id = child._id.toString();
      ids.push(id);
      queue.push(id);
    }
  }
  return ids;
};

/** Mongo owner ids for keys/customers scoped to actor hierarchy; null = global (super admin). */
const getScopedOwnerIds = async (actor) => {
  if (!actor || actor.enterpriseRole === "super_admin") return null;
  const ownerIds = [actor._id];
  if (actor.enterpriseRole !== "dealer") {
    const descendants = await getDescendantIds(actor._id);
    ownerIds.push(...descendants.map((id) => new mongoose.Types.ObjectId(id)));
  }
  return ownerIds;
};

module.exports = { getDescendantIds, getScopedOwnerIds };
