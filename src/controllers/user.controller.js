const mongoose = require("mongoose");
const User = require("../models/UserModel.js");
const Customer = require("../models/Customer.model.js");
const Business = require("../models/BusinessProfile.js");
const admin = require("../config/firebaseAdmin.js");
const bcrypt = require("bcrypt");

const completeProfile = async (req, res) => {
  const { name, email } = req.body;
  const userId = req.userId;
  if (!name || !email) {
    return res
      .status(400)
      .json({ success: false, message: "Name and email are required" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.name = name;
    user.email = email;

    user.isProfileCompleted = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error completing profile",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const isDisabled = req.query?.isDisabled;
    const search = req.query.search || undefined;

    const skip = (page - 1) * limit;
    const filter = {};
    console.log(isDisabled);
    if (isDisabled?.trim()) {
      const isDisabled = req.query.isDisabled;
      filter.isDisabled = isDisabled;
    }
    if (search) {
      filter.$or = [
        { phone: { $regex: search.trim(), $options: "i" } },
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Add role filter
    if (req.query.role) {
      filter.role = req.query.role;
    }

    const users = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .select("-phoneOtp.attempts -phoneOtp.codeHash")
      .populate("BusinessProfile");

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);
    const pagination = {
      totalUsers,
      totalPages: totalPages,
      currentPage: page,
      pageSize: users.length,
    };

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
      pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving users",
      error: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-phoneOtp.attempts -phoneOtp.codeHash -password",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const business = await Business.findOne({ userId: user._id });
    let distributor = null;
    let stockist = null;

    if (user.parentId) {
      const parent = await User.findById(user.parentId).select(
        "name phone entityCode enterpriseRole parentId",
      );
      if (parent?.enterpriseRole === "distributor") {
        distributor = {
          name: parent.name,
          phone: parent.phone,
          entityCode: parent.entityCode,
        };
        if (parent.parentId) {
          const stk = await User.findById(parent.parentId).select(
            "name phone entityCode",
          );
          if (stk) {
            stockist = {
              name: stk.name,
              phone: stk.phone,
              entityCode: stk.entityCode,
            };
          }
        }
      } else if (parent?.enterpriseRole === "stockist") {
        stockist = {
          name: parent.name,
          phone: parent.phone,
          entityCode: parent.entityCode,
        };
      }
    }

    const data = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      enterpriseRole: user.enterpriseRole,
      entityCode: user.entityCode,
      city: user.city,
      territory: user.territory,
      keys: user.keys ?? 0,
      profileUrl: user.profileUrl,
      isProfileCompleted: user.isProfileCompleted,
      shopName: business?.name || null,
      distributor,
      stockist,
    };

    res.status(200).json({ success: true, message: "User found", data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding user",
      error: error.message,
    });
  }
};
const getBusinesProfileByUserId = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    console.log(userId, "sadadasdasds");
    const user = await Business.findOne({
      userId: userId,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Business profile not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Business profile  found", data: user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding user: " + error.message,
      error: error.message,
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    let userId = req.userId;

    // const userId = req.userId;
    const profileUrl = req?.file ? `uploads/${req.file.filename}` : undefined;

    const { name, email, dateOfBirth } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (profileUrl) updateData.profileUrl = profileUrl;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-phoneOtp.attempts -phoneOtp.codeHash");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};
const updateBusinessProfile = async (req, res) => {
  try {
    console.log(req.file);
    const userId = req.userId;

    const { name, email, phone } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (userId) updateData.userId = userId;
    if (req?.file) updateData.profileUrl = `uploads/${req.file.filename}`;

    const user = await Business.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true, upsert: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "Business profile updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating Business profile",
      error: error.message,
    });
  }
};
const toggleUser = async (req, res) => {
  try {
    const userId = req.params.userId;

    let user = await User.findById(userId);
    let customer = null;

    if (!user) {
      // Check if it's a Customer ID
      customer = await Customer.findById(userId);
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "User or Customer not found" });
      }
      
      const newStatus = !customer.isDisabled;
      customer.isDisabled = newStatus;
      customer.isBanned = newStatus;
      await customer.save();

      // Also sync corresponding User if exists
      if (customer.customerMobileNumber) {
        const phone = customer.customerMobileNumber.replace(/\D/g, "").slice(-10);
        await User.updateMany(
          { phone: { $regex: `${phone}$` } },
          { $set: { isDisabled: newStatus, isBanned: newStatus } }
        );
      }

      return res.json({
        success: true,
        message: `Customer ${newStatus ? "banned/deactivated" : "activated"} successfully`,
        customer,
      });
    }

    const newStatus = !user.isDisabled;
    user.isDisabled = newStatus;
    user.isBanned = newStatus;
    await user.save();

    // Also sync corresponding Customer if exists
    if (user.phone) {
      const phone = String(user.phone).replace(/\D/g, "").slice(-10);
      await Customer.updateMany(
        { customerMobileNumber: { $regex: `${phone}$` } },
        { $set: { isDisabled: newStatus, isBanned: newStatus } }
      );
    }

    res.json({
      success: true,
      message: `User ${newStatus ? "banned/deactivated" : "activated"} successfully`,
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const saveFcmToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { pushNotificationToken } = req.body;
    if (!pushNotificationToken || !userId) {
      return res.status(200).json({ error: "Token and userId are required" });
    }
    await User.findByIdAndUpdate(userId, {
      pushNotificationToken: pushNotificationToken,
    });
    const check = await admin
      .messaging()
      .subscribeToTopic([pushNotificationToken], "allUsers");
    console.dir(check.errors, { depth: null });

    return res.json({
      success: true,
      message: "Token registered successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

const updateUserByAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      agencyName,
      address,
      city,
      state,
      district,
      pincode,
      gstNumber,
    } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (agencyName) updateData.agencyName = agencyName;
    if (address) updateData.address = address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (district) updateData.district = district;
    if (pincode) updateData.pincode = pincode;
    if (gstNumber) updateData.gstNumber = gstNumber;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

const createShopEmployee = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingAdmin = await User.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin/Employee with this email already exists",
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newAdmin = await User.create({
      email: email.toLowerCase(),
      name: name,
      password: hashedPassword,
      role: "admin", // Shop Employees are admins
      isProfileCompleted: true,
    });

    res.status(201).json({
      success: true,
      message: "Shop Employee created successfully",
      data: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Create Shop Employee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during creation",
      error: error.message,
    });
  }
};

module.exports = {
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
};
