const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

/**
 * Mobile access-token guard. Verifies the short-lived JWT, loads the user,
 * and rejects disabled/deleted accounts. Attaches req.userId, req.role, req.mobileUser.
 */
const mobileAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, code: "NO_TOKEN", message: "Authorization token is required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.typ && decoded.typ !== "access") {
      return res
        .status(401)
        .json({ success: false, code: "WRONG_TOKEN_TYPE", message: "Access token required" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, code: "USER_NOT_FOUND", message: "Account not found" });
    }
    if (user.isDisabled || user.isDeleted) {
      return res
        .status(403)
        .json({ success: false, code: "ACCOUNT_DISABLED", message: "Account is disabled" });
    }

    req.userId = decoded.userId;
    req.role = decoded.role;
    req.enterpriseRole = decoded.enterpriseRole || user.enterpriseRole || null;
    req.mobileUser = user;
    next();
  } catch (error) {
    const expired = error.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      code: expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: expired ? "Access token expired" : "Invalid token",
    });
  }
};

module.exports = mobileAuth;
