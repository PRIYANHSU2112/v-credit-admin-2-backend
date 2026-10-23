const express = require("express");
const {
  createSupportInfo,
  updateSupportInfo,
  getSupportInfo,
} = require("../controllers/Company.controller.js");
const { uploadImage } = require("../middleware/upload.middleware.js");

const router = express.Router();

router.post("/", createSupportInfo);
router.put("/", uploadImage.fields([
  { name: 'favIcon', maxCount: 1 },
  { name: 'loader', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), updateSupportInfo);
router.get("/", getSupportInfo);

module.exports = router;
