const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure local uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log("Using Disk Storage for all uploads to ensure stability.");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${timestamp}${ext}`);
  },
});

const multerFilter = (req, file, cb) => {
  cb(null, true);
};

const uploadVideo = multer({
  storage: storage,
  fileFilter: multerFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const uploadImage = multer({
  storage: storage,
  fileFilter: multerFilter,
  limits: { fileSize: 30 * 1024 * 1024 },
});

module.exports = { uploadVideo, uploadImage };
