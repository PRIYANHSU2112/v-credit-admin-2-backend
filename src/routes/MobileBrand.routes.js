const express = require("express");
const router = express.Router();
const validateRequest = require("../middleware/validateRequest");
const {
  createBrandSchema,
  updateBrandSchema,
} = require("../validations/mobileBrandValidation");
const {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} = require("../controllers/MobileBrand.controller");

router.post("/", validateRequest(createBrandSchema), createBrand);
router.get("/", getAllBrands);
router.get("/:id", getBrandById);
router.put("/:id", validateRequest(updateBrandSchema), updateBrand);
router.delete("/:id", deleteBrand);

module.exports = router;
