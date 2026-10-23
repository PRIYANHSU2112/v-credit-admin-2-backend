const ContactUs = require("../models/ContactUs.model");

const createContactUs = async (req, res) => {
  try {
    const customerId = req.userId; // Will be undefined if not logged in
    const { name, email, phone, message } = req.body;

    const contactData = {
      name,
      email,
      phone,
      message,
    };

    if (customerId) {
      contactData.customerId = customerId;
    }

    const contact = await ContactUs.create(contactData);

    return res.status(201).json({
      success: true,
      message: "Contact request submitted successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllContactUs = async (req, res) => {
  try {
    const contacts = await ContactUs.find().populate(
      "customerId",
      "name email",
    );
    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getContactUsByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;
    const contact = await ContactUs.find({ customerId });

    if (!contact || contact.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ContactUs found for this customer",
      });
    }

    return res.status(200).json({
      success: true,
      count: contact.length,
      data: contact,
    });
  } catch (error) {
    console.error("Error fetching contact by customer ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createContactUs,
  getAllContactUs,
  getContactUsByCustomerId,
};
