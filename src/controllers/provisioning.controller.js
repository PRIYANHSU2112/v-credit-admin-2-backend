const fs = require("fs");
const {
  DEFAULT_APK_FILENAME,
  getApkPath,
  computeApkChecksum,
  getSignatureChecksum,
  buildProvisioningPayload,
} = require("../services/provisioning.service");

const getProvisioningPayload = async (req, res) => {
  try {
    const { loanId, imei1, imei2, customerId } = req.query;
    const result = buildProvisioningPayload({
      req,
      loanId,
      imei1,
      imei2,
      customerId,
    });

    return res.status(200).json({
      success: true,
      data: {
        payload: result.payload,
        payloadJson: result.payloadJson,
        downloadUrl: result.downloadUrl,
        signatureChecksum: result.signatureChecksum,
        componentName: result.componentName,
      },
      message: "Provisioning payload generated",
    });
  } catch (error) {
    console.error("Provisioning payload error:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to generate provisioning payload",
    });
  }
};

const downloadProvisioningApk = (req, res) => {
  try {
    const apkPath = getApkPath();
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({
        success: false,
        message: "Provisioning APK not uploaded yet",
      });
    }

    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${DEFAULT_APK_FILENAME}"`,
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.sendFile(apkPath);
  } catch (error) {
    console.error("Provisioning APK download error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to serve provisioning APK",
    });
  }
};

const getProvisioningInfo = (req, res) => {
  try {
    const apkPath = getApkPath();
    const exists = fs.existsSync(apkPath);
    let fileChecksum = null;
    let sizeBytes = null;

    if (exists) {
      const stats = fs.statSync(apkPath);
      sizeBytes = stats.size;
      fileChecksum = process.env.PROVISIONING_APK_CHECKSUM || computeApkChecksum(apkPath);
    }

    return res.status(200).json({
      success: true,
      data: {
        apkAvailable: exists,
        apkPath,
        sizeBytes,
        // Cert-based checksum used in the QR payload (robust across rebuilds).
        signatureChecksum: getSignatureChecksum(),
        // Informational only: SHA-256 of the current APK file.
        fileChecksum,
        downloadUrl: exists ? getApkDownloadUrlSafe(req) : null,
        componentName:
          process.env.PROVISIONING_COMPONENT_NAME ||
          "com.vlocker/com.vlocker.MyDeviceAdminReceiver",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to read provisioning info",
    });
  }
};

function getApkDownloadUrlSafe(req) {
  try {
    return buildProvisioningPayload({ req }).downloadUrl;
  } catch {
    return null;
  }
}

module.exports = {
  getProvisioningPayload,
  downloadProvisioningApk,
  getProvisioningInfo,
};
