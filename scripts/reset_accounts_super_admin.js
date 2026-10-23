require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/models/UserModel");
const BusinessProfile = require("../src/models/BusinessProfile");
const RefreshToken = require("../src/models/RefreshToken.model");
const ImpersonationLog = require("../src/models/ImpersonationLog.model");

const SUPER_ADMIN_EMAIL = "princekumar5252@gmail.com";
const SUPER_ADMIN_PASSWORD = "#prince123";
const MONGO_URI = process.env.MONGO_URI;

async function resetAccountsToSingleSuperAdmin() {
  if (!MONGO_URI) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.\n--- RESET ALL ACCOUNTS ---\n");

    const profiles = await BusinessProfile.deleteMany({});
    console.log(`BusinessProfile deleted: ${profiles.deletedCount}`);

    const tokens = await RefreshToken.deleteMany({});
    console.log(`RefreshToken deleted: ${tokens.deletedCount}`);

    const impersonation = await ImpersonationLog.deleteMany({});
    console.log(`ImpersonationLog deleted: ${impersonation.deletedCount}`);

    const users = await User.deleteMany({});
    console.log(`Users deleted: ${users.deletedCount}`);

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
    const superAdmin = await User.create({
      name: "Super Admin",
      email: SUPER_ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      enterpriseRole: "super_admin",
      entityCode: "ADM-0001",
      enterpriseStatus: "Active",
      isProfileCompleted: true,
      isDisabled: false,
      keys: 0,
    });

    console.log("\n--- SUPER ADMIN CREATED ---");
    console.log("Email:", superAdmin.email);
    console.log("Password:", SUPER_ADMIN_PASSWORD);
    console.log("Role: super_admin");
    console.log("\nLogin URLs:");
    console.log("- Admin: http://localhost:3001");
    console.log("- Enterprise: http://localhost:5173/admin/login");
  } catch (error) {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

resetAccountsToSingleSuperAdmin();
