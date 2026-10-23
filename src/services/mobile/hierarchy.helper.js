const User = require("../../models/UserModel");

/**
 * Walk up the parentId chain from a dealer to resolve the full
 * dealer → distributor → stockist hierarchy snapshot.
 * Roles are matched by enterpriseRole, tolerating gaps in the chain.
 */
const resolveHierarchy = async (startUserId) => {
  const snapshot = {
    dealerId: null,
    distributorId: null,
    stockistId: null,
    superAdminId: null,
  };

  let current = await User.findById(startUserId).select(
    "_id parentId enterpriseRole",
  );
  let guard = 0;

  while (current && guard < 10) {
    guard += 1;
    switch (current.enterpriseRole) {
      case "dealer":
        snapshot.dealerId = current._id;
        break;
      case "distributor":
        snapshot.distributorId = current._id;
        break;
      case "stockist":
        snapshot.stockistId = current._id;
        break;
      case "super_admin":
        snapshot.superAdminId = current._id;
        break;
      default:
        break;
    }
    if (!current.parentId) break;
    current = await User.findById(current.parentId).select(
      "_id parentId enterpriseRole",
    );
  }

  return snapshot;
};

module.exports = { resolveHierarchy };
