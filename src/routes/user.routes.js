const express = require("express");
const {
  completeProfile,
  getAllUsers,
  getUserById,
  updateUserProfile,
  updateBusinessProfile,
  getBusinesProfileByUserId,
  toggleUser,
  saveFcmToken,
  deleteUser,
  updateUserByAdmin,
  createShopEmployee,
} = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const validateRequest = require("../middleware/validateRequest");
const {
  completeProfileSchema,
  updateUserProfileSchema,
  paramIdSchema,
} = require("../validations/userValidation");
const { uploadImage } = require("../middleware/upload.middleware");

const router = express.Router();

router.use(authMiddleware);

// router.post("/complete-profile", authMiddleware, completeProfile);
// router.get("/", getAllUsers);
// router.put("/", updateUserProfile);
// router.get("/:id", getUserById);

router.post(
  "/complete-profile",
  validateRequest(completeProfileSchema, "body"),
  completeProfile,
);

router.get("/", adminMiddleware, getAllUsers);

router.put(
  "/",
  uploadImage.single("profileUrl"),
  validateRequest(updateUserProfileSchema, "body"),
  updateUserProfile,
);
router.put(
  "/businessProfile",
  uploadImage.single("profileUrl"),
  updateBusinessProfile,
);

router.get("/businessProfile", getBusinesProfileByUserId);
router.get("/:id", getUserById);
router.post("/saveFcmToken", saveFcmToken);
router.patch("/disable/:userId", adminMiddleware, toggleUser);

// Admin Actions
router.delete("/:id", adminMiddleware, deleteUser); // Hard Delete
// Admin Update (Name, Email, Password) — must be admin-only.
router.put("/:id", adminMiddleware, updateUserByAdmin);
router.post("/admin", adminMiddleware, createShopEmployee); // Create new Shop Employee (Admin)

module.exports = router;
