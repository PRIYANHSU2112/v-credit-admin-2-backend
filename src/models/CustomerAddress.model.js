const mongoose = require("mongoose");
 

const addressSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customerAddress: {
      type: String,
    },
    customerState: {
      type: String,
 
    },
    customerCity: {
      type: String,
 
    },
    landmark: {
      type: String,
    },
    customerProfession: {
      type: String,
    },
    customerSalary: {
      type: Number,
    },
    customerContact1: {
      type: String,
    },
    customerContact2: {
      type: String,
    },
    otherInfo: {
      type: String,
    },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
