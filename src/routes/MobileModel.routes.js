const express = require("express");
const router = express.Router();
const validateRequest = require("../middleware/validateRequest");
const {
  createModelSchema,
  updateModelSchema,
} = require("../validations/mobileModelValidation");
const {
  createModel,
  getAllModels,
  getModelById,
  updateModel,
  deleteModel,
} = require("../controllers/MobileModel.controller");

router.post("/", validateRequest(createModelSchema), createModel);
router.get("/", getAllModels);
router.get("/:id", getModelById);
router.put("/:id", validateRequest(updateModelSchema), updateModel);
router.delete("/:id", deleteModel);

module.exports = router;
