const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_APK_FILENAME = "VLocker.apk";
const DEFAULT_COMPONENT =
  "com.vlocker/com.vlocker.MyDeviceAdminReceiver";

/**
 * URL-safe base64 of the SHA-256 of the app's SIGNING CERTIFICATE.
 * This is the robust checksum Android uses for QR Device-Owner provisioning:
 * unlike a per-file APK hash it stays valid across rebuilds (as long as the
 * SAME keystore signs the APK), so provisioning never fails with a
 * "checksum mismatch". Recompute (apksigner verify --print-certs) only if the
 * signing keystore ever changes, then override via PROVISIONING_SIGNATURE_CHECKSUM.
 */
const DEFAULT_SIGNATURE_CHECKSUM = "jEpUPqYe74lMZjbWgNd0H6LCWmAlL6LXqE-izuSXR1k";

function getSignatureChecksum() {
  return (
    process.env.PROVISIONING_SIGNATURE_CHECKSUM || DEFAULT_SIGNATURE_CHECKSUM
  );
}

function getApkPath() {
  const configured = process.env.PROVISIONING_APK_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(__dirname, "../../", configured);
  }
  return path.join(__dirname, "../../public", DEFAULT_APK_FILENAME);
}

function toUrlSafeBase64(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function computeApkChecksum(apkPath) {
  const fileBuffer = fs.readFileSync(apkPath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest();
  return toUrlSafeBase64(hash);
}

function getApkDownloadUrl(req) {
  const configured = process.env.PROVISIONING_APK_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${host}/api/provisioning/apk/${DEFAULT_APK_FILENAME}`;
}

function buildProvisioningPayload({ req, loanId, imei1, imei2, customerId } = {}) {
  const apkPath = getApkPath();
  if (!fs.existsSync(apkPath)) {
    const err = new Error(
      `Provisioning APK not found at ${apkPath}. Build release APK and copy it there.`,
    );
    err.status = 503;
    throw err;
  }

  const signatureChecksum = getSignatureChecksum();
  const downloadUrl = getApkDownloadUrl(req);
  const componentName =
    process.env.PROVISIONING_COMPONENT_NAME || DEFAULT_COMPONENT;

  const adminExtras = {};
  if (loanId) adminExtras.loanId = String(loanId);
  if (imei1) adminExtras.imei1 = String(imei1);
  if (imei2) adminExtras.imei2 = String(imei2);
  if (customerId) adminExtras.customerId = String(customerId);

  const payload = {
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": componentName,
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
      downloadUrl,
    // Certificate-based checksum (survives APK rebuilds). Do NOT also send
    // PACKAGE_CHECKSUM — a per-file hash mismatch would block provisioning.
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
      signatureChecksum,
    "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true,
    "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
    "android.app.extra.PROVISIONING_SKIP_EDUCATION_SCREENS": true,
    "android.app.extra.PROVISIONING_USE_MOBILE_DATA": true,
    "android.app.extra.PROVISIONING_ORGANIZATION_NAME": "V-Locker",
  };

  const minVersion = Number(process.env.PROVISIONING_MIN_VERSION_CODE || 13);
  if (Number.isFinite(minVersion) && minVersion > 0) {
    payload["android.app.extra.PROVISIONING_DEVICE_ADMIN_MIN_VERSION_CODE"] =
      minVersion;
  }

  if (Object.keys(adminExtras).length > 0) {
    payload["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] = adminExtras;
  }

  return {
    payload,
    payloadJson: JSON.stringify(payload),
    downloadUrl,
    signatureChecksum,
    componentName,
    apkPath,
  };
}

module.exports = {
  DEFAULT_APK_FILENAME,
  getApkPath,
  computeApkChecksum,
  getSignatureChecksum,
  buildProvisioningPayload,
};
