const Address = require("../models/CustomerAddress.model");
const Customer = require("../models/Customer.model");

const createAddress = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({
      _id: customerId,
      createdBy: req.userId,
    });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you are not authorized",
      });
    }

    const address = new Address({
      ...req.body,
      customerId,
      createdBy: req.userId,
    });
    await address.save();
    res.status(201).json({
      success: true,
      message: "Address created successfully",
      address,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating address",
      error: error.message,
    });
  }
};

const getAddressesForCustomer = async (req, res) => {
  try {
    const addresses = await Address.find({
      createdBy: req.userId,
    });

    res.status(200).json({
      success: true,
      message: "Addresses retrieved successfully",
      data:addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving addresses",
      error: error.message,
    });
  }
};

const getAddressById = async (req, res) => {
  try {
    const address = await Address.findOne({
      customerId: req.params.customerId,
      createdBy: req.userId,
    });
    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }
    res.status(200).json({ success: true, message: "Address found", data:address });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding address",
      error: error.message,
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const customerId=req.params.customerId
    const updateData={...req.body};
    updateData.customerId=customerId;
    const address = await Address.findOneAndUpdate(
      {
        customerId:customerId,
        createdBy: req.userId,
      },
      { $set: updateData },
      { new: true, runValidators: true ,upsert:true}
    );
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or you are not authorized",
      });
    }
    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data:address,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating address",
      error: error.message,
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.addressId,
      createdBy: req.userId,
    });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or you are not authorized",
      });
    }
    res
      .status(200)
      .json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error deleting address",
        error: error.message,
      });
  }
};

module.exports = {
  createAddress,
  getAddressesForCustomer,
  getAddressById,
  updateAddress,
  deleteAddress,
};
