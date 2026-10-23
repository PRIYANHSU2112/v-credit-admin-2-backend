/**
 * Enterprise Multi-Level Data Scoping Hierarchy Seed Script
 * Hierarchy: Super Admin -> Stockist -> Distributor -> Dealer -> End User (Customer + Loan + Device + Key)
 * 
 * Features:
 * - 2 Super Admins (admin@vcredit.in & vlocker@gmail.com)
 * - 3 Regional Stockists (North, Central MP, Western)
 * - 6 City Distributors (including Low-Key and Critical 0-Key cases)
 * - 12 Retail Dealers (with varied statuses: Active, Monitoring, Suspended)
 * - 36 End Users (KYC Customers, CustomerLoans, Devices, CustomerAddresses)
 * - 300+ Enterprise Keys with exact parentage, activations, statuses, and device bindings
 * - 18+ Key Transfers with invoice batch IDs and audit logs
 * - Complete KeyInventory synchronization for all enterprise users
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/models/UserModel");
const EnterpriseKey = require("../src/models/EnterpriseKey.model");
const KeyInventory = require("../src/models/KeyInventory.model");
const KeyTransfer = require("../src/models/KeyTransfer.model");
const Customer = require("../src/models/Customer.model");
const Loan = require("../src/models/CustomerLoan.model");
const Device = require("../src/models/Device.model");
const Address = require("../src/models/CustomerAddress.model");
const AuditLog = require("../src/models/AuditLog.model");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env");
  process.exit(1);
}

const PASSWORD_HASH = bcrypt.hashSync("password123", 10);

async function seedDatabase() {
  try {
    console.log("🔗 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected successfully.\n");

    console.log("🧹 Clearing old enterprise data to ensure clean referential integrity...");
    await Promise.all([
      User.deleteMany({}),
      EnterpriseKey.deleteMany({}),
      KeyInventory.deleteMany({}),
      KeyTransfer.deleteMany({}),
      Customer.deleteMany({}),
      Loan.deleteMany({}),
      Device.deleteMany({}),
      Address.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log("✅ Existing collections cleared.\n");

    // =========================================================================
    // 1. SUPER ADMINS (Top of Hierarchy)
    // =========================================================================
    console.log("👑 Creating Super Admins...");
    const superAdmin = await User.create({
      name: "Master Vault Admin",
      email: "admin@vcredit.in",
      phone: "9800000001",
      password: PASSWORD_HASH,
      role: "admin",
      enterpriseRole: "super_admin",
      entityCode: "ADM-1001",
      city: "New Delhi",
      territory: "National Headquarters",
      enterpriseStatus: "Active",
      isProfileCompleted: true,
      isDisabled: false,
      keys: 50000,
    });

    const vlockerAdmin = await User.create({
      name: "V-Locker Super Admin",
      email: "vlocker@gmail.com",
      phone: "9800000002",
      password: PASSWORD_HASH,
      role: "admin",
      enterpriseRole: "super_admin",
      entityCode: "ADM-1002",
      city: "Bhopal",
      territory: "Central Command",
      enterpriseStatus: "Active",
      isProfileCompleted: true,
      isDisabled: false,
      keys: 50000,
    });
    console.log(`   -> Created Super Admin: ${superAdmin.email} (${superAdmin.entityCode})`);
    console.log(`   -> Created Super Admin: ${vlockerAdmin.email} (${vlockerAdmin.entityCode})`);

    // =========================================================================
    // 2. STOCKISTS (Level 1 Hierarchy under Super Admin)
    // =========================================================================
    console.log("\n📦 Creating 3 Stockists under Super Admin...");
    const stockistData = [
      {
        name: "Music Beats Telecom & Logistics",
        email: "stockist.north@vcredit.in",
        phone: "9407262622",
        entityCode: "STK-1001",
        territory: "North Zone (Delhi-NCR)",
        city: "New Delhi",
        gst: "07AAAAA0000A1Z5",
        status: "Active",
        parentId: superAdmin._id,
      },
      {
        name: "Central MP Logistics & Stockist",
        email: "stk.central@vcredit.in",
        phone: "9425001122",
        entityCode: "STK-1002",
        territory: "Madhya Pradesh Central",
        city: "Tikamgarh",
        gst: "23BBBBB1111B1Z6",
        status: "Active",
        parentId: superAdmin._id,
      },
      {
        name: "Apex Western Mega Stockist",
        email: "apex.stockist@vcredit.in",
        phone: "9820011223",
        entityCode: "STK-1003",
        territory: "Western Region (MH & MP-West)",
        city: "Indore",
        gst: "27CCCCC2222C1Z7",
        status: "Active",
        parentId: superAdmin._id,
      },
    ];

    const stockists = [];
    for (const s of stockistData) {
      const user = await User.create({
        name: s.name,
        email: s.email,
        phone: s.phone,
        password: PASSWORD_HASH,
        role: "admin",
        enterpriseRole: "stockist",
        entityCode: s.entityCode,
        territory: s.territory,
        city: s.city,
        gst: s.gst,
        enterpriseStatus: s.status,
        parentId: s.parentId,
        isProfileCompleted: true,
      });
      stockists.push(user);
      console.log(`   -> Stockist: ${user.name} | ${user.entityCode} | ${user.email}`);
    }

    // =========================================================================
    // 3. DISTRIBUTORS (Level 2 Hierarchy under Stockists)
    // =========================================================================
    console.log("\n🏢 Creating 6 Distributors under Stockists...");
    const distributorData = [
      // Under Stockist 0 (North Zone)
      {
        name: "VEDA ENTERPRISE Hub",
        email: "delhi.dist@vcredit.in",
        phone: "7000142357",
        entityCode: "DST-1001",
        territory: "Delhi Central Hub",
        city: "New Delhi",
        status: "Active",
        parentId: stockists[0]._id,
        stockistId: stockists[0]._id,
      },
      {
        name: "Noida Smart Distribution Hub",
        email: "noida.dist@vcredit.in",
        phone: "9818765432",
        entityCode: "DST-1002",
        territory: "NCR East & Expressway",
        city: "Noida",
        status: "Active",
        parentId: stockists[0]._id,
        stockistId: stockists[0]._id,
        isLowKey: true, // Will have <= 10 keys for Low Warning Reports
      },
      // Under Stockist 1 (Central MP)
      {
        name: "anujdistributer Betul Hub",
        email: "anuj.dist@vcredit.in",
        phone: "9425334455",
        entityCode: "DST-1003",
        territory: "Betul District Hub",
        city: "Betul",
        status: "Active",
        parentId: stockists[1]._id,
        stockistId: stockists[1]._id,
      },
      {
        name: "Bundelkhand Tele-Link Hub",
        email: "bundelkhand.dist@vcredit.in",
        phone: "9425990011",
        entityCode: "DST-1004",
        territory: "Bundelkhand Central Hub",
        city: "Tikamgarh",
        status: "Active",
        parentId: stockists[1]._id,
        stockistId: stockists[1]._id,
      },
      // Under Stockist 2 (Western Region)
      {
        name: "Malwa Region Distribution",
        email: "malwa.dist@vcredit.in",
        phone: "9820334455",
        entityCode: "DST-1005",
        territory: "Malwa & Indore Urban",
        city: "Indore",
        status: "Active",
        parentId: stockists[2]._id,
        stockistId: stockists[2]._id,
      },
      {
        name: "Mumbai Suburban Logistics Hub",
        email: "mumbai.dist@vcredit.in",
        phone: "9820990011",
        entityCode: "DST-1006",
        territory: "Mumbai Western Suburbs",
        city: "Mumbai",
        status: "Monitoring",
        parentId: stockists[2]._id,
        stockistId: stockists[2]._id,
        isCriticalKey: true, // 0 keys for Critical Low Key Reports
      },
    ];

    const distributors = [];
    for (const d of distributorData) {
      const user = await User.create({
        name: d.name,
        email: d.email,
        phone: d.phone,
        password: PASSWORD_HASH,
        role: "admin",
        enterpriseRole: "distributor",
        entityCode: d.entityCode,
        territory: d.territory,
        city: d.city,
        enterpriseStatus: d.status,
        parentId: d.parentId,
        isProfileCompleted: true,
      });
      user._stockistId = d.stockistId;
      user._isLowKey = d.isLowKey;
      user._isCriticalKey = d.isCriticalKey;
      distributors.push(user);
      console.log(`   -> Distributor: ${user.name} | ${user.entityCode} | Parent: ${d.parentId}`);
    }

    // =========================================================================
    // 4. DEALERS (Level 3 Hierarchy under Distributors)
    // =========================================================================
    console.log("\n🏪 Creating 12 Retail Dealers under Distributors...");
    const dealerData = [
      // Under Dist 0 (VEDA ENTERPRISE Hub)
      {
        name: "Apex Phone Gallery",
        email: "metro.telecom@vcredit.in",
        phone: "9811029384",
        entityCode: "DLR-1001",
        city: "Connaught Place, New Delhi",
        territory: "Central Delhi",
        status: "Active",
        distributorIdx: 0,
      },
      {
        name: "Karol Bagh Mobile Hub",
        email: "karolbagh.dlr@vcredit.in",
        phone: "9811234567",
        entityCode: "DLR-1002",
        city: "Karol Bagh, New Delhi",
        territory: "West Delhi",
        status: "Active",
        distributorIdx: 0,
      },
      // Under Dist 1 (Noida Smart Distribution Hub)
      {
        name: "Noida Sector 18 Cellular",
        email: "sector18.dlr@vcredit.in",
        phone: "9818112233",
        entityCode: "DLR-1003",
        city: "Sector 18, Noida",
        territory: "Noida Central",
        status: "Monitoring",
        distributorIdx: 1,
        isCritical: true, // 0 keys
      },
      {
        name: "Greater Noida Digital Store",
        email: "gnoida.dlr@vcredit.in",
        phone: "9818998877",
        entityCode: "DLR-1004",
        city: "Pari Chowk, Greater Noida",
        territory: "Greater Noida",
        status: "Active",
        distributorIdx: 1,
        isLow: true, // 5 keys
      },
      // Under Dist 2 (anujdistributer Betul Hub)
      {
        name: "Betul City Mobiles",
        email: "betul.dlr@vcredit.in",
        phone: "9425556677",
        entityCode: "DLR-1005",
        city: "Main Market, Betul",
        territory: "Betul City",
        status: "Active",
        distributorIdx: 2,
      },
      {
        name: "Ganj Mobile Care",
        email: "ganj.dlr@vcredit.in",
        phone: "9425778899",
        entityCode: "DLR-1006",
        city: "Railway Station Road, Betul Ganj",
        territory: "Betul Ganj",
        status: "Active",
        distributorIdx: 2,
      },
      // Under Dist 3 (Bundelkhand Tele-Link Hub)
      {
        name: "Sahu Electronics & Mobiles",
        email: "sahu.dlr@vcredit.in",
        phone: "9425123456",
        entityCode: "DLR-1007",
        city: "Nazarbagh, Tikamgarh",
        territory: "Tikamgarh Market",
        status: "Active",
        distributorIdx: 3,
      },
      {
        name: "Jhansi Road Telecom",
        email: "jhansi.dlr@vcredit.in",
        phone: "9425654321",
        entityCode: "DLR-1008",
        city: "Jhansi Road, Tikamgarh",
        territory: "Tikamgarh Outer",
        status: "Suspended", // Suspended dealer for testing status filters
        distributorIdx: 3,
      },
      // Under Dist 4 (Malwa Region Distribution)
      {
        name: "56 Dukan Mobile Junction",
        email: "56dukan.dlr@vcredit.in",
        phone: "9820556677",
        entityCode: "DLR-1009",
        city: "56 Dukan, Indore",
        territory: "Indore Central",
        status: "Active",
        distributorIdx: 4,
      },
      {
        name: "Rajwada Smart Phones",
        email: "rajwada.dlr@vcredit.in",
        phone: "9820778899",
        entityCode: "DLR-1010",
        city: "Rajwada Market, Indore",
        territory: "Indore Old City",
        status: "Active",
        distributorIdx: 4,
      },
      // Under Dist 5 (Mumbai Suburban Logistics Hub)
      {
        name: "Andheri West Cellular",
        email: "andheri.dlr@vcredit.in",
        phone: "9820123456",
        entityCode: "DLR-1011",
        city: "Lokhandwala, Andheri West, Mumbai",
        territory: "Mumbai Suburban",
        status: "Active",
        distributorIdx: 5,
      },
      {
        name: "Bandra Digital Gallery",
        email: "bandra.dlr@vcredit.in",
        phone: "9820654321",
        entityCode: "DLR-1012",
        city: "Hill Road, Bandra West, Mumbai",
        territory: "Mumbai Suburban",
        status: "Active",
        distributorIdx: 5,
      },
    ];

    const dealers = [];
    for (const d of dealerData) {
      const parentDist = distributors[d.distributorIdx];
      const stockistId = parentDist._stockistId;
      const user = await User.create({
        name: d.name,
        email: d.email,
        phone: d.phone,
        password: PASSWORD_HASH,
        role: "admin",
        enterpriseRole: "dealer",
        entityCode: d.entityCode,
        territory: d.territory,
        city: d.city,
        enterpriseStatus: d.status,
        parentId: parentDist._id,
        isProfileCompleted: true,
      });
      user._distributorId = parentDist._id;
      user._stockistId = stockistId;
      user._isCritical = d.isCritical;
      user._isLow = d.isLow;
      dealers.push(user);
      console.log(`   -> Dealer: ${user.name} | ${user.entityCode} | Under: ${parentDist.name}`);
    }

    // =========================================================================
    // 5. END USERS (Customers + Loans + Addresses + Devices + Activated Keys)
    // =========================================================================
    console.log("\n📱 Creating 36 End Users (Customers + Loans + Devices + Keys) across 12 Dealers...");

    const customerCatalog = [
      { name: "Aarav Sharma", phone: "9811001001", brand: "Samsung", model: "Galaxy S24 Ultra", price: 129999, loan: 80000, emi: 7200, city: "New Delhi", emiStatus: "PAID" },
      { name: "Rahul Verma", phone: "9811001002", brand: "Vivo", model: "V30 Pro 5G", price: 41999, loan: 30000, emi: 2750, city: "New Delhi", emiStatus: "PAID" },
      { name: "Priya Patel", phone: "9811001003", brand: "OnePlus", model: "Nord CE4", price: 24999, loan: 18000, emi: 1650, city: "New Delhi", emiStatus: "PENDING" },
      { name: "Rohit Gupta", phone: "9811001004", brand: "Xiaomi", model: "Redmi Note 13 Pro+", price: 31999, loan: 22000, emi: 2050, city: "New Delhi", emiStatus: "PAID" },
      { name: "Neha Singh", phone: "9811001005", brand: "Realme", model: "12 Pro+ 5G", price: 29999, loan: 20000, emi: 1850, city: "New Delhi", emiStatus: "PAID" },
      { name: "Aditya Chouhan", phone: "9811001006", brand: "Samsung", model: "Galaxy A55 5G", price: 39999, loan: 28000, emi: 2600, city: "New Delhi", emiStatus: "PENDING" },
      { name: "Vikram Joshi", phone: "9818002001", brand: "Oppo", model: "Reno 11 Pro 5G", price: 37999, loan: 25000, emi: 2300, city: "Noida", emiStatus: "OVERDUE", locked: true },
      { name: "Sneha Pawar", phone: "9818002002", brand: "Samsung", model: "Galaxy M34 5G", price: 18999, loan: 14000, emi: 1300, city: "Noida", emiStatus: "PAID" },
      { name: "Amit Sahu", phone: "9818002003", brand: "Vivo", model: "Y200 5G", price: 21999, loan: 16000, emi: 1500, city: "Noida", emiStatus: "PAID" },
      { name: "Pooja Jain", phone: "9818002004", brand: "OnePlus", model: "12R 5G", price: 39999, loan: 28000, emi: 2600, city: "Greater Noida", emiStatus: "PAID" },
      { name: "Manoj Kumar", phone: "9818002005", brand: "Xiaomi", model: "Redmi 13C 5G", price: 11999, loan: 8000, emi: 750, city: "Greater Noida", emiStatus: "PENDING" },
      { name: "Anjali Yadav", phone: "9818002006", brand: "Realme", model: "Narzo 70 Pro", price: 19999, loan: 15000, emi: 1400, city: "Greater Noida", emiStatus: "PAID" },
      { name: "Deepak Soni", phone: "9425003001", brand: "Samsung", model: "Galaxy A35 5G", price: 30999, loan: 22000, emi: 2050, city: "Betul", emiStatus: "PAID" },
      { name: "Sunita Mishra", phone: "9425003002", brand: "Vivo", model: "T3 5G", price: 19999, loan: 14000, emi: 1300, city: "Betul", emiStatus: "PAID" },
      { name: "Rajesh Kadam", phone: "9425003003", brand: "OnePlus", model: "Nord 3 5G", price: 28999, loan: 20000, emi: 1850, city: "Betul", emiStatus: "PENDING" },
      { name: "Kavita Rathi", phone: "9425003004", brand: "Oppo", model: "F25 Pro 5G", price: 23999, loan: 17000, emi: 1580, city: "Betul Ganj", emiStatus: "PAID" },
      { name: "Suresh Meena", phone: "9425003005", brand: "Xiaomi", model: "Note 13 5G", price: 17999, loan: 13000, emi: 1200, city: "Betul Ganj", emiStatus: "PAID" },
      { name: "Monika Sen", phone: "9425003006", brand: "Samsung", model: "Galaxy S23 FE", price: 49999, loan: 35000, emi: 3200, city: "Betul Ganj", emiStatus: "OVERDUE", locked: true },
      { name: "Gopal Tiwari", phone: "9425004001", brand: "Vivo", model: "V29e 5G", price: 25999, loan: 18000, emi: 1650, city: "Tikamgarh", emiStatus: "PAID" },
      { name: "Meena Ahirwar", phone: "9425004002", brand: "Realme", model: "11 Pro 5G", price: 23999, loan: 16000, emi: 1500, city: "Tikamgarh", emiStatus: "PAID" },
      { name: "Dinesh Lodhi", phone: "9425004003", brand: "Samsung", model: "Galaxy M15 5G", price: 13999, loan: 9000, emi: 850, city: "Tikamgarh", emiStatus: "PENDING" },
      { name: "Sangeeta Dubey", phone: "9425004004", brand: "OnePlus", model: "Nord CE 3 Lite", price: 19999, loan: 14000, emi: 1300, city: "Tikamgarh", emiStatus: "PAID" },
      { name: "Pawan Chaurasia", phone: "9425004005", brand: "Oppo", model: "A79 5G", price: 18999, loan: 13000, emi: 1200, city: "Tikamgarh", emiStatus: "PAID" },
      { name: "Kajal Vishwakarma", phone: "9425004006", brand: "Xiaomi", model: "Redmi 12 5G", price: 12999, loan: 9000, emi: 850, city: "Tikamgarh", emiStatus: "PAID" },
      { name: "Harish Solanki", phone: "9820005001", brand: "Samsung", model: "Galaxy Z Flip 5", price: 99999, loan: 60000, emi: 5400, city: "Indore", emiStatus: "PAID" },
      { name: "Archana Patidar", phone: "9820005002", brand: "OnePlus", model: "Open 5G", price: 139999, loan: 85000, emi: 7600, city: "Indore", emiStatus: "PAID" },
      { name: "Vishal Malviya", phone: "9820005003", brand: "Vivo", model: "X100 Pro", price: 89999, loan: 55000, emi: 5000, city: "Indore", emiStatus: "PENDING" },
      { name: "Ritu Mandloi", phone: "9820005004", brand: "Realme", model: "GT 6 5G", price: 40999, loan: 28000, emi: 2600, city: "Indore", emiStatus: "PAID" },
      { name: "Anand Gehlot", phone: "9820005005", brand: "Xiaomi", model: "Xiaomi 14 5G", price: 69999, loan: 45000, emi: 4100, city: "Indore", emiStatus: "PAID" },
      { name: "Shweta Bairagi", phone: "9820005006", brand: "Samsung", model: "Galaxy A25 5G", price: 26999, loan: 19000, emi: 1750, city: "Indore", emiStatus: "PAID" },
      { name: "Sameer Merchant", phone: "9820006001", brand: "Apple", model: "iPhone 15 Pro", price: 134900, loan: 90000, emi: 8100, city: "Mumbai", emiStatus: "PAID" },
      { name: "Tasneem Kapadia", phone: "9820006002", brand: "Samsung", model: "Galaxy S24+", price: 99999, loan: 65000, emi: 5900, city: "Mumbai", emiStatus: "PAID" },
      { name: "Kunal Deshmukh", phone: "9820006003", brand: "OnePlus", model: "12 5G", price: 64999, loan: 42000, emi: 3800, city: "Mumbai", emiStatus: "PENDING" },
      { name: "Natasha Fernandes", phone: "9820006004", brand: "Vivo", model: "V30 5G", price: 33999, loan: 24000, emi: 2200, city: "Mumbai", emiStatus: "PAID" },
      { name: "Zubair Khan", phone: "9820006005", brand: "Realme", model: "12+ 5G", price: 20999, loan: 15000, emi: 1400, city: "Mumbai", emiStatus: "PAID" },
      { name: "Alia D'Almeida", phone: "9820006006", brand: "Oppo", model: "Reno 11 5G", price: 29999, loan: 21000, emi: 1950, city: "Mumbai", emiStatus: "PAID" },
    ];

    const customerIds = [];
    const loanIds = [];
    const activatedKeyIds = [];
    let actKeySeq = 1001;

    for (let i = 0; i < customerCatalog.length; i++) {
      const item = customerCatalog[i];
      // Distribute 3 customers per dealer (12 dealers * 3 = 36 customers)
      const dealer = dealers[Math.floor(i / 3)];
      const distributorId = dealer._distributorId;
      const stockistId = dealer._stockistId;

      const customer = await Customer.create({
        customerName: item.name,
        customerMobileNumber: item.phone,
        email: `${item.name.toLowerCase().replace(/[^a-z]/g, "")}@gmail.com`,
        address: `${item.city}, Madhya Pradesh / India`,
        isVerified: true,
        createdBy: dealer._id,
        kyc: {
          aadhaar: { number: `XXXX-XXXX-${String(3000 + i)}` },
          pan: { number: `ABCDE${String(1000 + i)}F` },
        },
      });
      customerIds.push(customer._id);

      await Address.create({
        customerId: customer._id,
        createdBy: dealer._id,
        customerAddress: `Flat ${101 + i}, Street ${1 + (i % 5)}, ${item.city}`,
        customerCity: item.city,
        customerState: item.city.includes("Delhi") ? "Delhi" : item.city.includes("Noida") ? "Uttar Pradesh" : item.city.includes("Mumbai") ? "Maharashtra" : "Madhya Pradesh",
        customerProfession: i % 2 === 0 ? "Salaried Professional" : "Self-Employed Trader",
        customerSalary: 25000 + (i * 1500),
      });

      const imei1 = `86754305000${String(100 + i)}`;
      const imei2 = `86754305000${String(200 + i)}`;
      const isLocked = Boolean(item.locked);

      // Past dates for activation trend (over last 6 months)
      const activationDate = new Date(Date.now() - ((36 - i) * 4 * 86400000));

      const loan = await Loan.create({
        customerId: customer._id,
        createdBy: dealer._id,
        loanAmount: item.loan,
        mobilePrice: item.price,
        downPayment: item.price - item.loan,
        loanStatus: item.emiStatus === "PENDING" ? "PENDING" : "APPROVED",
        deviceUnlockStatus: isLocked ? "LOCKED" : "UNLOCKED",
        numberOfEMIs: 12,
        installmentsPaid: item.emiStatus === "PAID" ? 4 : item.emiStatus === "OVERDUE" ? 2 : 0,
        emiAmount: item.emi,
        firstEmiDate: activationDate,
        imeiNumber1: imei1,
        imeiNumber2: imei2,
        mobileBrand: item.brand,
        mobileModel: item.model,
        shopName: dealer.name,
        devicePolicy: {
          isResetAllowed: false,
          isDeveloperOptionsBlocked: true,
          frpAccounts: [`${dealer.entityCode.toLowerCase()}@vcredit.in`],
        },
        installments: [
          { installmentNumber: 1, amount: item.emi, status: "PAID", paidAmount: item.emi, dueDate: new Date(Date.now() - 60 * 86400000) },
          { installmentNumber: 2, amount: item.emi, status: item.emiStatus === "OVERDUE" ? "OVERDUE" : "PAID", paidAmount: item.emiStatus === "OVERDUE" ? 0 : item.emi, dueDate: new Date(Date.now() - 30 * 86400000) },
          { installmentNumber: 3, amount: item.emi, status: item.emiStatus === "PENDING" ? "PENDING" : item.emiStatus === "OVERDUE" ? "OVERDUE" : "PAID", dueDate: new Date(Date.now() + 5 * 86400000) },
        ],
      });
      loanIds.push(loan._id);

      const keyNumber = `VK-2026-ACT-${actKeySeq++}`;
      const enterpriseKey = await EnterpriseKey.create({
        keyNumber,
        keyType: "standard",
        batchId: `BATCH-2026-ACT-${Math.floor(i / 10) + 1}`,
        currentOwnerId: dealer._id,
        originalOwnerId: superAdmin._id,
        status: isLocked ? "Locked" : "Activated",
        activationDate,
        expiryDate: new Date(activationDate.getTime() + 365 * 86400000),
        assignedToCustomerId: customer._id,
        activatedForCustomerId: customer._id,
        activatedForLoanId: loan._id,
        imei: imei1,
        dealerId: dealer._id,
        distributorId,
        stockistId,
        history: [
          { action: "Generated", performedBy: superAdmin._id, note: "Initial vault generation" },
          { action: "Transferred", fromUserId: superAdmin._id, toUserId: stockistId, performedBy: superAdmin._id },
          { action: "Transferred", fromUserId: stockistId, toUserId: distributorId, performedBy: stockistId },
          { action: "Transferred", fromUserId: distributorId, toUserId: dealer._id, performedBy: distributorId },
          { action: isLocked ? "Locked" : "Activated", performedBy: dealer._id, note: isLocked ? "Overdue EMI lock" : "Device enrollment" },
        ],
      });
      activatedKeyIds.push(enterpriseKey);

      await Device.create({
        deviceId: imei1,
        customerId: customer._id,
        loanId: loan._id,
        keyId: enterpriseKey._id,
        dealerId: dealer._id,
        distributorId,
        stockistId,
        imei1,
        imei2,
        brand: item.brand,
        deviceModel: item.model,
        androidVersion: "Android 14",
        status: "ACTIVATED",
        isLocked,
        lockStatus: isLocked ? "LOCKED" : "UNLOCKED",
        session: {
          battery: 70 + (i % 25),
          networkType: "5G",
          onlineStatus: true,
          lastSeen: new Date(Date.now() - (i * 20 * 60000)),
          location: {
            latitude: 28.6139 + (i * 0.01),
            longitude: 77.2090 + (i * 0.01),
          },
        },
      });
    }
    console.log(`   -> Created 36 Customers, Loans, Addresses, Devices, and Activated Keys.`);

    // =========================================================================
    // 6. ENTERPRISE KEYS POOL (Central Vault, Stockists, Distributors, Dealers)
    // =========================================================================
    console.log("\n🔑 Generating Available, Transferred, and Vault Key Pools...");

    // Master Vault (Super Admin owned Generated keys)
    const vaultKeys = [];
    for (let k = 1; k <= 120; k++) {
      vaultKeys.push({
        keyNumber: `VK-2026-MSTR-${String(1000 + k).slice(1)}`,
        batchId: "BATCH-2026-MSTR-01",
        currentOwnerId: superAdmin._id,
        originalOwnerId: superAdmin._id,
        status: "Generated",
        history: [{ action: "Generated", performedBy: superAdmin._id, note: "Central Vault Ingestion" }],
      });
    }
    await EnterpriseKey.insertMany(vaultKeys);
    console.log(`   -> Inserted 120 Master Vault Keys for Super Admin`);

    // Stockists' Available Keys
    for (let sIdx = 0; sIdx < stockists.length; sIdx++) {
      const stk = stockists[sIdx];
      const stkKeys = [];
      for (let k = 1; k <= 35; k++) {
        stkKeys.push({
          keyNumber: `VK-2026-STK${sIdx + 1}-${String(100 + k).slice(1)}`,
          batchId: `BATCH-2026-STK-0${sIdx + 1}`,
          currentOwnerId: stk._id,
          originalOwnerId: superAdmin._id,
          stockistId: stk._id,
          status: "Received",
          history: [
            { action: "Generated", performedBy: superAdmin._id },
            { action: "Transferred", fromUserId: superAdmin._id, toUserId: stk._id, performedBy: superAdmin._id },
          ],
        });
      }
      await EnterpriseKey.insertMany(stkKeys);
    }
    console.log(`   -> Inserted 105 Keys in Stockist Wallets`);

    // Distributors' Available Keys
    for (let dIdx = 0; dIdx < distributors.length; dIdx++) {
      const dist = distributors[dIdx];
      const distKeys = [];
      const keyCount = dist._isCriticalKey ? 0 : dist._isLowKey ? 7 : 25;

      for (let k = 1; k <= keyCount; k++) {
        distKeys.push({
          keyNumber: `VK-2026-DST${dIdx + 1}-${String(100 + k).slice(1)}`,
          batchId: `BATCH-2026-DST-0${dIdx + 1}`,
          currentOwnerId: dist._id,
          originalOwnerId: superAdmin._id,
          stockistId: dist._stockistId,
          distributorId: dist._id,
          status: "Received",
          history: [
            { action: "Generated", performedBy: superAdmin._id },
            { action: "Transferred", fromUserId: dist._stockistId, toUserId: dist._id, performedBy: dist._stockistId },
          ],
        });
      }
      if (distKeys.length > 0) {
        await EnterpriseKey.insertMany(distKeys);
      }
    }
    console.log(`   -> Inserted Scoped Keys in Distributor Wallets (Including Critical 0 and Low Warning <= 10)`);

    // Dealers' Available Keys
    for (let dlrIdx = 0; dlrIdx < dealers.length; dlrIdx++) {
      const dealer = dealers[dlrIdx];
      const dealerKeys = [];
      const keyCount = dealer._isCritical ? 0 : dealer._isLow ? 5 : 18;

      for (let k = 1; k <= keyCount; k++) {
        dealerKeys.push({
          keyNumber: `VK-2026-DLR${dlrIdx + 1}-${String(100 + k).slice(1)}`,
          batchId: `BATCH-2026-DLR-0${dlrIdx + 1}`,
          currentOwnerId: dealer._id,
          originalOwnerId: superAdmin._id,
          stockistId: dealer._stockistId,
          distributorId: dealer._distributorId,
          dealerId: dealer._id,
          status: "Received",
          history: [
            { action: "Generated", performedBy: superAdmin._id },
            { action: "Transferred", fromUserId: dealer._distributorId, toUserId: dealer._id, performedBy: dealer._distributorId },
          ],
        });
      }
      if (dealerKeys.length > 0) {
        await EnterpriseKey.insertMany(dealerKeys);
      }
    }
    console.log(`   -> Inserted Ready-to-Activate Keys in Dealer Wallets (Including Critical 0 and Low 5)`);

    // =========================================================================
    // 7. KEY TRANSFERS (Super Admin -> Stockists -> Distributors -> Dealers)
    // =========================================================================
    console.log("\n📄 Creating Hierarchical Key Transfer Records with Invoices...");

    const transferRecords = [
      // Super Admin -> Stockists
      { from: superAdmin._id, to: stockists[0]._id, qty: 5000, batch: "TR-STK-DELHI-001", note: "Northern Region Q1 Allocation" },
      { from: superAdmin._id, to: stockists[1]._id, qty: 5000, batch: "TR-STK-MP-001", note: "Central MP Regional Quota Dispatch" },
      { from: superAdmin._id, to: stockists[2]._id, qty: 8000, batch: "TR-STK-WEST-001", note: "Western Zone Logistics Bulk Dispatch" },

      // Stockist 0 -> Distributors
      { from: stockists[0]._id, to: distributors[0]._id, qty: 2400, batch: "TR-DST-DEL-001", note: "VEDA ENTERPRISE Core Capital Allocation" },
      { from: stockists[0]._id, to: distributors[1]._id, qty: 500, batch: "TR-DST-NOI-001", note: "Noida Smart Distribution Expressway Allocation" },

      // Stockist 1 -> Distributors
      { from: stockists[1]._id, to: distributors[2]._id, qty: 1800, batch: "TR-DST-BTL-001", note: "anujdistributer Betul Hub Quota" },
      { from: stockists[1]._id, to: distributors[3]._id, qty: 1100, batch: "TR-DST-BUN-001", note: "Bundelkhand District Trunk Transfer" },

      // Stockist 2 -> Distributors
      { from: stockists[2]._id, to: distributors[4]._id, qty: 2000, batch: "TR-DST-IND-001", note: "Malwa Region Commercial Dispatch" },
      { from: stockists[2]._id, to: distributors[5]._id, qty: 1500, batch: "TR-DST-MUM-001", note: "Mumbai Suburban High-Volume Dispatch" },

      // Distributor 0 -> Dealers
      { from: distributors[0]._id, to: dealers[0]._id, qty: 350, batch: "TR-DLR-CP-001", note: "Apex Phone Gallery Retail Allocation" },
      { from: distributors[0]._id, to: dealers[1]._id, qty: 280, batch: "TR-DLR-KB-001", note: "Karol Bagh Mobile Hub Inventory Refill" },

      // Distributor 1 -> Dealers
      { from: distributors[1]._id, to: dealers[2]._id, qty: 200, batch: "TR-DLR-S18-001", note: "Sector 18 Noida Initial Stock" },
      { from: distributors[1]._id, to: dealers[3]._id, qty: 150, batch: "TR-DLR-GNOI-001", note: "Greater Noida Retail Dispatch" },

      // Distributor 2 -> Dealers
      { from: distributors[2]._id, to: dealers[4]._id, qty: 300, batch: "TR-DLR-BTL-001", note: "Betul City Mobiles Prime Allocation" },
      { from: distributors[2]._id, to: dealers[5]._id, qty: 250, batch: "TR-DLR-GNJ-001", note: "Ganj Mobile Care Retail Allocation" },

      // Distributor 3 -> Dealers
      { from: distributors[3]._id, to: dealers[6]._id, qty: 200, batch: "TR-DLR-TKM-001", note: "Sahu Electronics & Mobiles Quota" },
      { from: distributors[3]._id, to: dealers[7]._id, qty: 100, batch: "TR-DLR-JHN-001", note: "Jhansi Road Store Stock Refill" },

      // Distributor 4 -> Dealers
      { from: distributors[4]._id, to: dealers[8]._id, qty: 400, batch: "TR-DLR-56D-001", note: "56 Dukan Mobile Junction Prime Quota" },
      { from: distributors[4]._id, to: dealers[9]._id, qty: 300, batch: "TR-DLR-RJW-001", note: "Rajwada Smart Phones Stock" },

      // Distributor 5 -> Dealers
      { from: distributors[5]._id, to: dealers[10]._id, qty: 500, batch: "TR-DLR-AND-001", note: "Andheri West Cellular Metro Dispatch" },
      { from: distributors[5]._id, to: dealers[11]._id, qty: 400, batch: "TR-DLR-BND-001", note: "Bandra Digital Gallery Metro Dispatch" },
    ];

    for (const tr of transferRecords) {
      await KeyTransfer.create({
        fromUserId: tr.from,
        toUserId: tr.to,
        quantity: tr.qty,
        batchId: tr.batch,
        status: "Completed",
        note: tr.note,
        performedBy: tr.from,
      });
    }
    console.log(`   -> Created ${transferRecords.length} Key Transfer Records linking the complete hierarchy.`);

    // =========================================================================
    // 8. SYNCHRONIZE KEY INVENTORIES (Accurate Counts for every Entity)
    // =========================================================================
    console.log("\n📊 Synchronizing KeyInventory & User Keys across all accounts...");

    const allUsers = [
      superAdmin,
      vlockerAdmin,
      ...stockists,
      ...distributors,
      ...dealers,
    ];

    for (const u of allUsers) {
      const [
        totalKeys,
        availableKeys,
        activatedKeys,
        lockedKeys,
      ] = await Promise.all([
        EnterpriseKey.countDocuments({ currentOwnerId: u._id, isDeleted: false }),
        EnterpriseKey.countDocuments({
          currentOwnerId: u._id,
          isDeleted: false,
          status: { $in: ["Generated", "Allocated", "Transferred", "Received", "Assigned"] },
        }),
        EnterpriseKey.countDocuments({ currentOwnerId: u._id, isDeleted: false, status: "Activated" }),
        EnterpriseKey.countDocuments({ currentOwnerId: u._id, isDeleted: false, status: "Locked" }),
      ]);

      const [transferredKeys, receivedKeys] = await Promise.all([
        KeyTransfer.aggregate([
          { $match: { fromUserId: u._id, status: "Completed" } },
          { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]),
        KeyTransfer.aggregate([
          { $match: { toUserId: u._id, status: "Completed" } },
          { $group: { _id: null, total: { $sum: "$quantity" } } },
        ]),
      ]);

      const transferredQty = transferredKeys[0]?.total || 0;
      const receivedQty = receivedKeys[0]?.total || 0;

      await KeyInventory.findOneAndUpdate(
        { userId: u._id },
        {
          userId: u._id,
          totalKeys: totalKeys + transferredQty,
          availableKeys,
          transferredKeys: transferredQty,
          receivedKeys: receivedQty,
          activatedKeys,
          lockedKeys,
          usedKeys: activatedKeys + lockedKeys,
          expiredKeys: 0,
        },
        { upsert: true, new: true }
      );

      // Set user.keys to availableKeys for immediate frontend topbar wallet display
      u.keys = availableKeys;
      await u.save();
    }
    console.log("   -> Synchronized KeyInventory for all 20 enterprise users.");

    // =========================================================================
    // 9. AUDIT LOGS (Realistic Event Stream)
    // =========================================================================
    console.log("\n📋 Seeding Audit Logs...");
    const auditEvents = [
      { action: "Created stockist", userName: superAdmin.name, role: "super_admin", target: "Music Beats Telecom (New Delhi)", severity: "info" },
      { action: "Created stockist", userName: superAdmin.name, role: "super_admin", target: "Central MP Logistics (Tikamgarh)", severity: "info" },
      { action: "Created stockist", userName: superAdmin.name, role: "super_admin", target: "Apex Western Mega Stockist (Indore)", severity: "info" },
      { action: "Dispatched batch", userName: superAdmin.name, role: "super_admin", target: "Batch TR-STK-DELHI-001 (5,000 Keys)", severity: "info" },
      { action: "Created distributor", userName: stockists[0].name, role: "stockist", target: "VEDA ENTERPRISE Hub (New Delhi)", severity: "info" },
      { action: "Created distributor", userName: stockists[1].name, role: "stockist", target: "anujdistributer Betul Hub (Betul)", severity: "info" },
      { action: "Created dealer", userName: distributors[0].name, role: "distributor", target: "Apex Phone Gallery (New Delhi)", severity: "info" },
      { action: "Created dealer", userName: distributors[2].name, role: "distributor", target: "Betul City Mobiles (Betul)", severity: "info" },
      { action: "Key Activated", userName: dealers[0].name, role: "dealer", target: "Aarav Sharma (Samsung Galaxy S24 Ultra)", severity: "success" },
      { action: "Device Locked", userName: "System Policy Bot", role: "system", target: "Vikram Joshi (Overdue EMI Lock applied)", severity: "warning" },
      { action: "Low Key Warning", userName: "Automated Monitor", role: "system", target: "Noida Smart Distribution (7 keys remaining)", severity: "warning" },
      { action: "Critical Inventory Alert", userName: "Automated Monitor", role: "system", target: "Mumbai Suburban Logistics (0 keys left)", severity: "critical" },
    ];

    for (const ev of auditEvents) {
      await AuditLog.create({
        action: ev.action,
        userName: ev.userName,
        role: ev.role,
        target: ev.target,
        severity: ev.severity,
        metadata: { timestamp: new Date() },
      });
    }
    console.log("   -> Created 12 Audit Log Events.");

    // =========================================================================
    // 10. SUMMARY & LOGIN CREDENTIALS CHEATSHEET
    // =========================================================================
    console.log("\n============================================================");
    console.log(" 🎉 HIERARCHICAL DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("============================================================");
    console.log("Hierarchy Breakdown:");
    console.log(`- Super Admins:  2 (Full Global Network Access)`);
    console.log(`- Stockists:     ${stockists.length} (Regional Scoping: North, Central MP, Western)`);
    console.log(`- Distributors:  ${distributors.length} (City Scoping: Delhi, Noida, Betul, Tikamgarh, Indore, Mumbai)`);
    console.log(`- Dealers:       ${dealers.length} (Retail Store Scoping)`);
    console.log(`- End Users:     ${customerCatalog.length} Customers with KYC, Loans & Device Locks`);
    console.log(`- EnterpriseKeys: ${await EnterpriseKey.countDocuments()} Total Keys in MongoDB`);
    console.log(`- Key Transfers: ${transferRecords.length} Completed Invoices`);
    console.log("------------------------------------------------------------");
    console.log("🔑 READY-TO-TEST LOGIN CREDENTIALS (All passwords: password123):");
    console.log("1. Super Admin:   admin@vcredit.in          (or vlocker@gmail.com)");
    console.log("2. Stockist 1:    stockist.north@vcredit.in (Music Beats - New Delhi)");
    console.log("3. Stockist 2:    stk.central@vcredit.in    (Central MP - Tikamgarh)");
    console.log("4. Stockist 3:    apex.stockist@vcredit.in  (Apex Western - Indore)");
    console.log("5. Distributor:   delhi.dist@vcredit.in     (VEDA ENTERPRISE)");
    console.log("6. Distributor:   anuj.dist@vcredit.in      (anujdistributer - Betul)");
    console.log("7. Distributor:   noida.dist@vcredit.in     (Low Key Warning: 7 keys)");
    console.log("8. Distributor:   mumbai.dist@vcredit.in    (Critical 0 Keys)");
    console.log("9. Dealer:        metro.telecom@vcredit.in  (Apex Phone Gallery)");
    console.log("10. Dealer:       betul.dlr@vcredit.in      (Betul City Mobiles)");
    console.log("11. Dealer:       sector18.dlr@vcredit.in   (Critical 0 Keys)");
    console.log("12. Dealer:       jhansi.dlr@vcredit.in     (Status: Suspended)");
    console.log("============================================================\n");

  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
}

seedDatabase();
