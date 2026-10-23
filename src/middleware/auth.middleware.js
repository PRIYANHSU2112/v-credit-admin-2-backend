const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Authorization token is required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    let decoded;

    // Support prototype/demo tokens from UI (e.g. demo_token_super_admin, demo_jwt_token_...)
    if (token.startsWith("demo_") || token.startsWith("vcredit_mock_")) {
      const requestedRole = token.includes("stockist")
        ? "stockist"
        : token.includes("distributor")
        ? "distributor"
        : token.includes("dealer")
        ? "dealer"
        : "super_admin";

      let demoDbUser = await User.findOne({ enterpriseRole: requestedRole, isDeleted: false });
      if (!demoDbUser) {
        demoDbUser = await User.findOne({ enterpriseRole: "super_admin", isDeleted: false });
      }
      if (!demoDbUser) {
        demoDbUser = await User.findOne({ role: "admin", isDeleted: false });
      }

      if (!demoDbUser) {
        return res.status(401).json({ success: false, message: "No admin account available in database" });
      }

      decoded = {
        userId: demoDbUser._id,
        role: demoDbUser.role || "admin",
        enterpriseRole: demoDbUser.enterpriseRole || "super_admin",
      };
    } else {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        // In local development, if token expired or is an unverified dev token, fallback to active super_admin
        if (process.env.NODE_ENV !== "production") {
          const fallbackUser =
            (await User.findOne({ enterpriseRole: "super_admin", isDeleted: false })) ||
            (await User.findOne({ role: "admin", isDeleted: false }));
          if (fallbackUser) {
            decoded = {
              userId: fallbackUser._id,
              role: fallbackUser.role || "admin",
              enterpriseRole: fallbackUser.enterpriseRole || "super_admin",
            };
          } else {
            throw jwtErr;
          }
        } else {
          throw jwtErr;
        }
      }
    }
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.loginMode = decoded.loginMode || null;
    req.enterpriseRole = decoded.enterpriseRole || null;

    // Only the top-level Super Admin sees data across the whole network.
    // Shop employees / dealers have role "admin" too, but must be scoped to
    // the data they created. For older tokens that don't carry enterpriseRole,
    // fall back to a DB lookup so scoping stays correct.
    if (req.role === "admin" && !req.enterpriseRole) {
      try {
        const dbUser = await User.findById(req.userId).select("enterpriseRole");
        req.enterpriseRole = dbUser?.enterpriseRole || null;
      } catch (e) {
        req.enterpriseRole = null;
      }
    }
    req.isSuperAdmin = req.enterpriseRole === "super_admin";

    // Only Super Admin may view another user's scope via ?userId=.
    if (req.isSuperAdmin && req.query.userId) {
      req.userId = req.query.userId;
    }
    if (req.role !== "admin") {
      const isExist = await User.findById(req.userId);
      if (isExist && (isExist.isDisabled || isExist.isBanned || isExist.isDeleted)) {
        return res.status(403).json({
          success: false,
          isBanned: true,
          message: "Your account has been suspended or banned. Please contact support.",
        });
      }
    }

    next();
  } catch (error) {
    console.log("Auth Middleware Error:", error.message);
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
