const express = require("express");
const { uploadVideo, uploadImage } = require("../middleware/upload.middleware");
const {
  createInstallationVideo,
  getAllInstallationVideos,
  updateInstallationVideo,
  deleteInstallationVideo,
} = require("../controllers/InstallationVideo.controller");

const router = express.Router();

router.post(
  "/upload-video",
  (req, res, next) => {
    const upload = uploadVideo.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
      { name: "channelImage" },
    ]);
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },

  createInstallationVideo,
);

// Simple file upload endpoint for wallpapers
router.post("/", (req, res) => {
  const upload = uploadImage.single("file");
  upload(req, res, (err) => {
    if (err) {
      console.error("Upload Middleware Error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Upload middleware error",
      });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    let finalPath = req.file.location || req.file.path || "";

    // If it's a disk path, make it relative to the uploads folder for web access
    if (!req.file.location && finalPath.includes("uploads")) {
      const parts = finalPath.split("uploads");
      finalPath = "uploads" + parts[parts.length - 1];
    }

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      filePath: finalPath.replace(/\\/g, "/"),
      filename: req.file.filename || req.file.key || "",
    });
  });
});

router.get("/", getAllInstallationVideos);

router.put(
  "/:id",
  (req, res, next) => {
    const upload = uploadVideo.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]);
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  updateInstallationVideo,
);

router.delete("/:id", deleteInstallationVideo);

module.exports = router;
