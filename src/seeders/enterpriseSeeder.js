/**
 * Enterprise seeder — run: node src/seeders/enterpriseSeeder.js
 */
require("dotenv").config();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const User = require("../models/UserModel");
const { generateKeys } = require("../services/keyEnterprise.service");
const { generateEntityCode } = require("../utils/keyGenerator");

const seed = async () => {
  await connectDB();

  const email = process.env.SUPER_ADMIN_EMAIL || "admin.local@vlocker.com";
  let superAdmin = await User.findOne({ email });

  if (!superAdmin) {
    const hashed = await bcrypt.hash(
      process.env.SUPER_ADMIN_PASSWORD || "Admin@123456",
      10,
    );
    superAdmin = await User.create({
      name: "Super Admin",
      email,
      password: hashed,
      role: "admin",
      enterpriseRole: "super_admin",
      entityCode: "ADM-0001",
      isProfileCompleted: true,
      enterpriseStatus: "Active",
    });
    console.log("Created super admin:", email);
  } else {
    superAdmin.enterpriseRole = "super_admin";
    superAdmin.role = "admin";
    if (!superAdmin.entityCode) superAdmin.entityCode = "ADM-0001";
    await superAdmin.save();
    console.log("Updated super admin:", email);
  }

  const territories = [
    { name: "Northline Distribution", territory: "Maharashtra", city: "Mumbai" },
    { name: "Meridian Digital", territory: "Karnataka", city: "Bengaluru" },
    { name: "Apex Secure Holdings", territory: "Delhi NCR", city: "New Delhi" },
  ];

  const stockists = [];
  for (let i = 0; i < territories.length; i++) {
    const t = territories[i];
    let stk = await User.findOne({ name: t.name, enterpriseRole: "stockist" });
    if (!stk) {
      const hashed = await bcrypt.hash("Stockist@123", 10);
      stk = await User.create({
        name: t.name,
        email: `stockist${i + 1}@vlocker.com`,
        password: hashed,
        phone: `900000000${i}`,
        role: "admin",
        enterpriseRole: "stockist",
        parentId: superAdmin._id,
        territory: t.territory,
        city: t.city,
        entityCode: generateEntityCode("STK", 1001 + i),
        enterpriseStatus: "Active",
        isProfileCompleted: true,
      });
      console.log("Created stockist:", stk.name, "| stockist" + (i + 1) + "@vlocker.com | Stockist@123");
    }
    stockists.push(stk);
  }

  for (let i = 0; i < stockists.length; i++) {
    const stk = stockists[i];
    let dist = await User.findOne({
      email: `distributor${i + 1}@vlocker.com`,
      enterpriseRole: "distributor",
    });
    if (!dist) {
      const hashed = await bcrypt.hash("Distributor@123", 10);
      dist = await User.create({
        name: `Distributor ${i + 1} — ${stk.territory}`,
        email: `distributor${i + 1}@vlocker.com`,
        password: hashed,
        phone: `910000000${i}`,
        role: "admin",
        enterpriseRole: "distributor",
        parentId: stk._id,
        territory: stk.territory,
        city: stk.city,
        entityCode: generateEntityCode("DST", 2001 + i),
        enterpriseStatus: "Active",
        isProfileCompleted: true,
      });
      console.log(
        "Created distributor:",
        dist.email,
        "| Distributor@123 | portal: /distributor/login",
      );
    }

    let dealer = await User.findOne({
      email: `dealer${i + 1}@vlocker.com`,
      enterpriseRole: "dealer",
    });
    if (!dealer) {
      const hashed = await bcrypt.hash("Dealer@123", 10);
      dealer = await User.create({
        name: `Dealer ${i + 1} — ${stk.city}`,
        email: `dealer${i + 1}@vlocker.com`,
        password: hashed,
        phone: `920000000${i}`,
        role: "admin",
        enterpriseRole: "dealer",
        parentId: dist._id,
        territory: stk.territory,
        city: stk.city,
        entityCode: generateEntityCode("DLR", 3001 + i),
        enterpriseStatus: "Active",
        isProfileCompleted: true,
      });
      console.log("Created dealer:", dealer.email, "| Dealer@123 | portal: /dealer/login");
    }
  }

  console.log("\n--- Portal logins ---");
  console.log("Super Admin:  /admin/login     ", email, "| Admin@123456");
  console.log("Stockist:     /stockist/login  stockist1@vlocker.com | Stockist@123");
  console.log("Distributor:  /distributor/login distributor1@vlocker.com | Distributor@123");
  console.log("Dealer:       /dealer/login    dealer1@vlocker.com | Dealer@123");

  if (superAdmin) {
    const existingKeys = await require("../models/EnterpriseKey.model").countDocuments({
      originalOwnerId: superAdmin._id,
    });
    if (existingKeys === 0) {
      await generateKeys({
        quantity: 1000,
        ownerId: superAdmin._id,
        performedBy: superAdmin._id,
      });
      console.log("Generated 1000 seed keys for super admin");
    }
  }

  console.log("Enterprise seed complete.");
  await mongoose.disconnect();
  process.exit(0);
};

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
