const express = require("express");
const router = express.Router();
const {
  createState,
  getAllStates,
  updateState,
  deleteState,
} = require("../controllers/State.controller");
const validateRequest = require("../middleware/validateRequest");
const {
  stateValidation,
  updateStateValidation,
} = require("../validations/stateValidation");

router.post("/", validateRequest(stateValidation), createState);
router.get("/", getAllStates);
router.put("/:id", validateRequest(updateStateValidation), updateState);
router.delete("/:id", deleteState);

module.exports = router;
