/**
 * V-Credit Full Enterprise Seed Script
 * Creates: SuperAdmin → 3 Stockists → 6 Distributors → 12 Dealers → 40 Customers → 40 Loans + 1000 Keys
 * Run: node src/seeders/fullSeed.js
 */
require("dotenv").config({ path: __dirname + "/../../.env" });
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const User = require("../models/UserModel");
const Customer = require("../models/Customer.model");
const Loan = require("../models/CustomerLoan.model");
const { generateKeys } = require("../services/keyEnterprise.service");
const { generateEntityCode } = require("../utils/keyGenerator");

const CUSTOMER_NAMES = [
  "Rohan Sharma", "Sunita Devi", "Mukesh Kumar", "Priya Patel", "Amit Joshi",
  "Kavita Singh", "Rajesh Verma", "Anita Gupta", "Deepak Shah", "Neha Mishra",
  "Vijay Kumar", "Pooja Yadav", "Sanjay Mehta", "Rekha Kapoor", "Arjun Reddy",
  "Meena Tiwari", "Ramesh Soni", "Geeta Dixit", "Suresh Jain", "Lakshmi Pillai",
  "Mohan Das", "Sarla Bai", "Naveen Kumar", "Ritu Agarwal", "Pradeep Nair",
  "Chameli Devi", "Santosh Singh", "Uma Shankar", "Babita Kumari", "Raju Bhai",
  "Harpreet Kaur", "Gurpreet Singh", "Anjali Sharma", "Dinesh Patel", "Vandana Srivastava",
  "Manoj Tiwari", "Poonam Choudhary", "Sunil Bhatt", "Asha Rani", "Kiran Bedi"
];

const DEVICE_CATALOG = [
  { brand: "Samsung", model: "Galaxy A15 5G", price: 18500, downPayment: 3500, emis: 6 },
  { brand: "Xiaomi", model: "Redmi Note 13 5G", price: 17999, downPayment: 2999, emis: 6 },
  { brand: "Vivo", model: "Vivo Y28 5G", price: 15499, downPayment: 2499, emis: 6 },
  { brand: "Realme", model: "Realme 12 Pro 5G", price: 25999, downPayment: 5999, emis: 6 },
  { brand: "OnePlus", model: "Nord CE 4 Lite", price: 19999, downPayment: 3999, emis: 6 },
  { brand: "Oppo", model: "Oppo F25 Pro 5G", price: 23999, downPayment: 4999, emis: 6 },
  { brand: "Motorola", model: "Moto G84 5G", price: 16999, downPayment: 2999, emis: 6 },
  { brand: "Samsung", model: "Galaxy M34 5G", price: 18999, downPayment: 3999, emis: 6 },
];

const CITY_TERRITORY = [
  { city: "Mumbai", territory: "Maharashtra" },
  { city: "Bengaluru", territory: "Karnataka" },
  { city: "New Delhi", territory: "Delhi NCR" },
];

function randomPhone() {
  return `${Math.floor(7000000000 + Math.random() * 3000000000)}`;
}

function randomImei() {
  return `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
}

async function seed() {
  await connectDB();
  console.log("✅ Connected to MongoDB\n");

  // ─── 1. Super Admin ────────────────────────────────────────────────────────
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@vlocker.com";
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@123456";
  let superAdmin = await User.findOne({ email: adminEmail });
  if (!superAdmin) {
    superAdmin = await User.create({
      name: "Super Admin",
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      phone: "9800000001",
      role: "admin",
      enterpriseRole: "super_admin",
      entityCode: "ADM-0001",
      isProfileCompleted: true,
      enterpriseStatus: "Active",
    });
    console.log(`✅ Super Admin: ${adminEmail} | ${adminPassword}`);
  } else {
    superAdmin.enterpriseRole = "super_admin";
    superAdmin.role = "admin";
    if (!superAdmin.entityCode) superAdmin.entityCode = "ADM-0001";
    await superAdmin.save();
    console.log(`♻️  Super Admin already exists: ${adminEmail}`);
  }

  // ─── 2. Stockists ─────────────────────────────────────────────────────────
  const stockistDefs = [
    { name: "Northline Distribution", agencyName: "Northline Distribution", ...CITY_TERRITORY[0] },
    { name: "Meridian Digital", agencyName: "Meridian Digital", ...CITY_TERRITORY[1] },
    { name: "Apex Secure Holdings", agencyName: "Apex Secure Holdings", ...CITY_TERRITORY[2] },
  ];

  const stockists = [];
  for (let i = 0; i < stockistDefs.length; i++) {
    const def = stockistDefs[i];
    const email = `stockist${i + 1}@vlocker.com`;
    let stk = await User.findOne({ email, enterpriseRole: "stockist" });
    if (!stk) {
      stk = await User.create({
        name: def.name,
        agencyName: def.agencyName,
        email,
        password: await bcrypt.hash("Stockist@123", 10),
        phone: `900000000${i}`,
        role: "admin",
        enterpriseRole: "stockist",
        parentId: superAdmin._id,
        territory: def.territory,
        city: def.city,
        entityCode: generateEntityCode("STK", 1001 + i),
        enterpriseStatus: "Active",
        isProfileCompleted: true,
        keys: 0,
      });
      console.log(`✅ Stockist[${i + 1}]: ${email} | Stockist@123 | ${def.city}`);
    } else {
      console.log(`♻️  Stockist already exists: ${email}`);
    }
    stockists.push(stk);
  }

  // ─── 3. Distributors ──────────────────────────────────────────────────────
  const distributors = [];
  for (let i = 0; i < stockists.length; i++) {
    const stk = stockists[i];
    for (let j = 0; j < 2; j++) {
      const idx = i * 2 + j;
      const email = `distributor${idx + 1}@vlocker.com`;
      let dist = await User.findOne({ email, enterpriseRole: "distributor" });
      if (!dist) {
        dist = await User.create({
          name: `${stk.city} Hub ${j + 1}`,
          agencyName: `${stk.city} Hub Distribution ${j + 1}`,
          email,
          password: await bcrypt.hash("Distributor@123", 10),
          phone: `910000000${idx}`,
          role: "admin",
          enterpriseRole: "distributor",
          parentId: stk._id,
          territory: stk.territory,
          city: stk.city,
          entityCode: generateEntityCode("DST", 2001 + idx),
          enterpriseStatus: "Active",
          isProfileCompleted: true,
          keys: 0,
        });
        console.log(`✅ Distributor[${idx + 1}]: ${email} | Distributor@123 | under ${stk.name}`);
      } else {
        console.log(`♻️  Distributor already exists: ${email}`);
      }
      distributors.push(dist);
    }
  }

  // ─── 4. Dealers ───────────────────────────────────────────────────────────
  const dealers = [];
  for (let i = 0; i < distributors.length; i++) {
    const dist = distributors[i];
    for (let j = 0; j < 2; j++) {
      const idx = i * 2 + j;
      const email = `dealer${idx + 1}@vlocker.com`;
      let dealer = await User.findOne({ email, enterpriseRole: "dealer" });
      if (!dealer) {
        dealer = await User.create({
          name: `${dist.city} Store ${j + 1}`,
          agencyName: `${dist.city} Mobile Store ${j + 1}`,
          email,
          password: await bcrypt.hash("Dealer@123", 10),
          phone: `920000000${idx}`,
          role: "admin",
          enterpriseRole: "dealer",
          parentId: dist._id,
          territory: dist.territory,
          city: dist.city,
          entityCode: generateEntityCode("DLR", 3001 + idx),
          enterpriseStatus: "Active",
          isProfileCompleted: true,
          keys: 0,
        });
        console.log(`✅ Dealer[${idx + 1}]: ${email} | Dealer@123 | under ${dist.name}`);
      } else {
        console.log(`♻️  Dealer already exists: ${email}`);
      }
      dealers.push(dealer);
    }
  }

  // ─── 5. Generate & Distribute Keys ────────────────────────────────────────
  const EnterpriseKey = require("../models/EnterpriseKey.model");
  const existingKeys = await EnterpriseKey.countDocuments({ originalOwnerId: superAdmin._id });
  if (existingKeys === 0) {
    await generateKeys({ quantity: 1000, ownerId: superAdmin._id, performedBy: superAdmin._id });
    console.log(`\n✅ Generated 1000 seed keys for Super Admin`);
  } else {
    console.log(`♻️  Keys already exist (${existingKeys}), skipping generation`);
  }

  // ─── 6. Customers & Loans ─────────────────────────────────────────────────
  const existingCustomers = await Customer.countDocuments({});
  if (existingCustomers >= CUSTOMER_NAMES.length) {
    console.log(`\n♻️  Customers already seeded (${existingCustomers}), skipping`);
  } else {
    console.log(`\n📦 Seeding ${CUSTOMER_NAMES.length} customers + loans...`);
    const now = new Date();
    const customersToCreate = [];
    const loansToCreate = [];

    for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
      const dealer = dealers[i % dealers.length];
      const dev = DEVICE_CATALOG[i % DEVICE_CATALOG.length];
      const phone = randomPhone();

      const custDoc = {
        customerName: CUSTOMER_NAMES[i],
        customerMobileNumber: phone,
        address: `Flat ${100 + i}, Block ${String.fromCharCode(65 + (i % 5))}, ${dealer.city}`,
        email: `customer${i + 1}@mail.com`,
        isVerified: true,
        createdBy: dealer._id,
      };
      customersToCreate.push(custDoc);

      // Build installments based on pattern
      const pattern = i % 4; // 0=current, 1=overdue, 2=closed, 3=due-soon
      const loanAmount = dev.price - dev.downPayment;
      const emiAmount = Math.round(loanAmount / dev.emis);
      let installments = [];
      let installmentsPaid = 0;
      let loanStatus = "APPROVED";
      let deviceUnlockStatus = "UNLOCKED";
      const firstEmiDate = new Date(now);

      if (pattern === 0) {
        installmentsPaid = 2;
        firstEmiDate.setMonth(now.getMonth() - 2);
        for (let e = 1; e <= dev.emis; e++) {
          const d = new Date(firstEmiDate); d.setMonth(firstEmiDate.getMonth() + e);
          installments.push({ installmentNumber: e, dueDate: d, amount: emiAmount,
            status: e <= 2 ? "PAID" : "PENDING", paidAmount: e <= 2 ? emiAmount : 0,
            paidDate: e <= 2 ? new Date(d.getTime() - 86400000) : null, lateFee: 0, bounceFee: 0 });
        }
      } else if (pattern === 1) {
        installmentsPaid = 1; deviceUnlockStatus = "LOCKED";
        firstEmiDate.setMonth(now.getMonth() - 2);
        for (let e = 1; e <= dev.emis; e++) {
          const d = new Date(firstEmiDate); d.setMonth(firstEmiDate.getMonth() + e);
          installments.push({ installmentNumber: e, dueDate: e === 2 ? new Date(now.getTime() - 10 * 86400000) : d,
            amount: emiAmount, status: e === 1 ? "PAID" : e === 2 ? "OVERDUE" : "PENDING",
            paidAmount: e === 1 ? emiAmount : 0, paidDate: e === 1 ? new Date(d.getTime() - 86400000) : null,
            lateFee: e === 2 ? 600 : 0, bounceFee: 0 });
        }
      } else if (pattern === 2) {
        installmentsPaid = dev.emis; loanStatus = "CLOSED";
        firstEmiDate.setMonth(now.getMonth() - dev.emis - 1);
        for (let e = 1; e <= dev.emis; e++) {
          const d = new Date(firstEmiDate); d.setMonth(firstEmiDate.getMonth() + e);
          installments.push({ installmentNumber: e, dueDate: d, amount: emiAmount, status: "PAID",
            paidAmount: emiAmount, paidDate: new Date(d.getTime() - 86400000), lateFee: 0, bounceFee: 0 });
        }
      } else {
        installmentsPaid = 1;
        firstEmiDate.setMonth(now.getMonth() - 1);
        for (let e = 1; e <= dev.emis; e++) {
          const d = e === 1 ? new Date(now.getTime() - 28 * 86400000) : e === 2 ? new Date(now.getTime() + 2 * 86400000) : new Date(now.getTime() + (e - 1) * 30 * 86400000);
          installments.push({ installmentNumber: e, dueDate: d, amount: emiAmount,
            status: e === 1 ? "PAID" : "PENDING", paidAmount: e === 1 ? emiAmount : 0,
            paidDate: e === 1 ? d : null, lateFee: 0, bounceFee: 0 });
        }
      }

      const totalPaid = installments.filter(x => x.status === "PAID").reduce((s, x) => s + x.paidAmount, 0);
      loansToCreate.push({
        _customerIdx: i,
        _dealerId: dealer._id,
        installationType: i % 3 === 0 ? "Old/Running Phone" : "New Phone",
        mobileBrand: dev.brand, mobileModel: dev.model,
        imeiNumber1: randomImei(), imeiNumber2: randomImei(),
        mobilePrice: dev.price, downPayment: dev.downPayment, processingFees: 500,
        frequency: "monthly", numberOfEMIs: dev.emis, loanAmount,
        emiAmount, amountPaid: dev.downPayment + totalPaid,
        amountLeft: Math.max(0, loanAmount - totalPaid),
        installmentsPaid, firstEmiDate, emiStartDate: firstEmiDate,
        emiEndDate: new Date(firstEmiDate.getTime() + dev.emis * 30 * 86400000),
        financer: "admin", paymentOptions: "upi", loanStatus, deviceUnlockStatus, installments,
        devicePolicy: {
          isResetAllowed: loanStatus === "CLOSED", isUninstallAllowed: false,
          isWallpaperEnabled: deviceUnlockStatus === "LOCKED",
          isVoiceReminderEnabled: deviceUnlockStatus === "LOCKED",
          isWhatsAppBlocked: deviceUnlockStatus === "LOCKED",
        },
      });
    }

    // Insert customers first
    const insertedCustomers = await Customer.insertMany(customersToCreate);
    console.log(`✅ Created ${insertedCustomers.length} customers`);

    // Map loans to real customer IDs
    const finalLoans = loansToCreate.map((l, i) => {
      const { _customerIdx, _dealerId, ...rest } = l;
      return { ...rest, customerId: insertedCustomers[i]._id, createdBy: _dealerId };
    });

    await Loan.insertMany(finalLoans);
    console.log(`✅ Created ${finalLoans.length} loans with installment schedules`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log("🎉 V-Credit Full Seed Complete!");
  console.log("══════════════════════════════════════════════");
  console.log(`Super Admin:   ${adminEmail} | ${adminPassword}`);
  console.log(`Stockist 1:    stockist1@vlocker.com | Stockist@123`);
  console.log(`Stockist 2:    stockist2@vlocker.com | Stockist@123`);
  console.log(`Stockist 3:    stockist3@vlocker.com | Stockist@123`);
  console.log(`Distributor 1: distributor1@vlocker.com | Distributor@123`);
  console.log(`Distributor 2: distributor2@vlocker.com | Distributor@123`);
  console.log(`Dealer 1:      dealer1@vlocker.com | Dealer@123`);
  console.log(`Dealer 2:      dealer2@vlocker.com | Dealer@123`);
  console.log("══════════════════════════════════════════════");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
