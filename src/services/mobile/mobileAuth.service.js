const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../../models/RefreshToken.model");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = process.env.MOBILE_ACCESS_TTL || "1h";
const REFRESH_TTL_DAYS = parseInt(process.env.MOBILE_REFRESH_TTL_DAYS || "30", 10);

const sha256 = (val) => crypto.createHash("sha256").update(val).digest("hex");

const signAccessToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
      enterpriseRole: user.enterpriseRole || null,
      typ: "access",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );

/**
 * Issue a fresh access + refresh token pair and persist the refresh token hash.
 */
const issueTokens = async (user, { deviceId, ip, userAgent } = {}) => {
  const accessToken = signAccessToken(user);

  const rawRefresh = crypto.randomBytes(48).toString("hex");
  const tokenHash = sha256(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    deviceId,
    ip,
    userAgent,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    accessExpiresIn: ACCESS_TTL,
    refreshExpiresAt: expiresAt,
  };
};

/**
 * Validate + rotate a refresh token. Old token is revoked, a new pair returned.
 * Detects reuse of an already-revoked token (possible theft) and revokes the family.
 */
const rotateRefreshToken = async (rawRefresh, user, ctx = {}) => {
  if (!rawRefresh) throw new Error("Refresh token required");
  const tokenHash = sha256(rawRefresh);

  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) throw new Error("Invalid refresh token");
  if (existing.expiresAt < new Date()) throw new Error("Refresh token expired");
  if (existing.revoked) {
    // Reuse of a revoked token → revoke everything for this user (breach response)
    await RefreshToken.updateMany(
      { userId: existing.userId, revoked: false },
      { revoked: true },
    );
    throw new Error("Refresh token reuse detected");
  }

  const pair = await issueTokens(user, {
    deviceId: existing.deviceId || ctx.deviceId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  existing.revoked = true;
  existing.replacedBy = sha256(pair.refreshToken);
  await existing.save();

  return pair;
};

const revokeRefreshToken = async (rawRefresh) => {
  if (!rawRefresh) return;
  await RefreshToken.updateOne(
    { tokenHash: sha256(rawRefresh) },
    { revoked: true },
  );
};

const revokeAllForUser = async (userId) => {
  await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
};

module.exports = {
  signAccessToken,
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
