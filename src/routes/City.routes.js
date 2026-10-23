const express = require("express");
const router = express.Router();
const {
  createCity,
  getAllCities,
  getCitiesByState,
  updateCity,
  deleteCity,
} = require("../controllers/City.controller");
const validateRequest = require("../middleware/validateRequest");
const {
  cityValidation,
  updateCityValidation,
} = require("../validations/cityValidation");

router.post("/", validateRequest(cityValidation), createCity);
router.get("/", getAllCities);
router.get("/state/:stateId", getCitiesByState);
router.put("/:id", validateRequest(updateCityValidation), updateCity);
router.delete("/:id", deleteCity);

module.exports = router;
