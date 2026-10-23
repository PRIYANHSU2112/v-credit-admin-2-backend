const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/../../.env" });

const Loan = require("../models/CustomerLoan.model");
const Customer = require("../models/Customer.model");
const User = require("../models/UserModel");

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

async function seedLoans() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not configured");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for EMI Safe seeding...");

  const customers = await Customer.find({});
  if (customers.length === 0) {
    console.log("No customers found to seed loans for.");
    await mongoose.disconnect();
    return;
  }

  // Clear existing customerloans to ensure clean, consistent data
  await Loan.deleteMany({});
  console.log("Cleared existing CustomerLoans.");

  const now = new Date();
  const createdLoans = [];

  for (let idx = 0; idx < customers.length; idx++) {
    const cust = customers[idx];
    const dev = DEVICE_CATALOG[idx % DEVICE_CATALOG.length];
    const loanAmount = dev.price - dev.downPayment;
    const emiAmount = Math.round(loanAmount / dev.emis);

    // Determine status pattern for rich UI testing
    // 0 = Active Current, 1 = Overdue Locked, 2 = Fully Settled/Closed, 3 = Due Soon
    const pattern = idx % 4;

    let installments = [];
    let installmentsPaid = 0;
    let loanStatus = "APPROVED";
    let deviceUnlockStatus = "UNLOCKED";
    let firstEmiDate = new Date();

    if (pattern === 0) {
      // Current / Upcoming: 2 of 6 paid, 3rd due next month
      installmentsPaid = 2;
      firstEmiDate.setMonth(now.getMonth() - 2);

      for (let i = 1; i <= dev.emis; i++) {
        const dDate = new Date(firstEmiDate);
        dDate.setMonth(firstEmiDate.getMonth() + i);

        if (i <= 2) {
          installments.push({
            installmentNumber: i,
            dueDate: dDate,
            amount: emiAmount,
            status: "PAID",
            paidAmount: emiAmount,
            paidDate: new Date(dDate.getTime() - 2 * 24 * 3600 * 1000),
            paymentMethod: i % 2 === 0 ? "upi" : "cash",
            lateFee: 0,
            bounceFee: 0,
          });
        } else {
          installments.push({
            installmentNumber: i,
            dueDate: dDate,
            amount: emiAmount,
            status: "PENDING",
            paidAmount: 0,
            paidDate: null,
            paymentMethod: null,
            lateFee: 0,
            bounceFee: 0,
          });
        }
      }
    } else if (pattern === 1) {
      // Overdue: 1 paid, 2nd installment was due 10 days ago (OVERDUE), device LOCKED
      installmentsPaid = 1;
      deviceUnlockStatus = "LOCKED";
      firstEmiDate.setMonth(now.getMonth() - 2);

      for (let i = 1; i <= dev.emis; i++) {
        const dDate = new Date(firstEmiDate);
        dDate.setMonth(firstEmiDate.getMonth() + i);

        if (i === 1) {
          installments.push({
            installmentNumber: 1,
            dueDate: dDate,
            amount: emiAmount,
            status: "PAID",
            paidAmount: emiAmount,
            paidDate: new Date(dDate.getTime() - 24 * 3600 * 1000),
            paymentMethod: "upi",
            lateFee: 0,
            bounceFee: 0,
          });
        } else if (i === 2) {
          // overdue by 10 days
          const overdueDate = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
          installments.push({
            installmentNumber: 2,
            dueDate: overdueDate,
            amount: emiAmount,
            status: "OVERDUE",
            paidAmount: 0,
            paidDate: null,
            paymentMethod: null,
            lateFee: 600,
            bounceFee: 0,
            remarks: "Missed payment date by 10 days",
          });
        } else {
          installments.push({
            installmentNumber: i,
            dueDate: dDate,
            amount: emiAmount,
            status: "PENDING",
            paidAmount: 0,
            paidDate: null,
            paymentMethod: null,
            lateFee: 0,
            bounceFee: 0,
          });
        }
      }
    } else if (pattern === 2) {
      // Fully Closed / Settled
      installmentsPaid = dev.emis;
      loanStatus = "CLOSED";
      deviceUnlockStatus = "UNLOCKED";
      firstEmiDate.setMonth(now.getMonth() - dev.emis - 1);

      for (let i = 1; i <= dev.emis; i++) {
        const dDate = new Date(firstEmiDate);
        dDate.setMonth(firstEmiDate.getMonth() + i);
        installments.push({
          installmentNumber: i,
          dueDate: dDate,
          amount: emiAmount,
          status: "PAID",
          paidAmount: emiAmount,
          paidDate: new Date(dDate.getTime() - 24 * 3600 * 1000),
          paymentMethod: "upi",
          lateFee: 0,
          bounceFee: 0,
        });
      }
    } else {
      // Due Soon (e.g. due in 2 days)
      installmentsPaid = 1;
      firstEmiDate.setMonth(now.getMonth() - 1);

      for (let i = 1; i <= dev.emis; i++) {
        if (i === 1) {
          const pastDate = new Date(now.getTime() - 28 * 24 * 3600 * 1000);
          installments.push({
            installmentNumber: 1,
            dueDate: pastDate,
            amount: emiAmount,
            status: "PAID",
            paidAmount: emiAmount,
            paidDate: pastDate,
            paymentMethod: "cash",
            lateFee: 0,
            bounceFee: 0,
          });
        } else if (i === 2) {
          const soonDate = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
          installments.push({
            installmentNumber: 2,
            dueDate: soonDate,
            amount: emiAmount,
            status: "PENDING",
            paidAmount: 0,
            paidDate: null,
            paymentMethod: null,
            lateFee: 0,
            bounceFee: 0,
          });
        } else {
          const futDate = new Date(now.getTime() + (i - 1) * 30 * 24 * 3600 * 1000);
          installments.push({
            installmentNumber: i,
            dueDate: futDate,
            amount: emiAmount,
            status: "PENDING",
            paidAmount: 0,
            paidDate: null,
            paymentMethod: null,
            lateFee: 0,
            bounceFee: 0,
          });
        }
      }
    }

    const totalPaidFromInstallments = installments
      .filter((inst) => inst.status === "PAID")
      .reduce((sum, inst) => sum + (inst.paidAmount || inst.amount), 0);

    const amountPaid = dev.downPayment + totalPaidFromInstallments;
    const amountLeft = Math.max(0, loanAmount - totalPaidFromInstallments);

    const imei1 = `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    const imei2 = `86${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

    const loanDoc = {
      customerId: cust._id,
      createdBy: cust.createdBy,
      installationType: idx % 3 === 0 ? "Old/Running Phone" : "New Phone",
      mobileBrand: dev.brand,
      mobileModel: dev.model,
      imeiNumber1: imei1,
      imeiNumber2: imei2,
      mobilePrice: dev.price,
      downPayment: dev.downPayment,
      processingFees: 500,
      frequency: "monthly",
      numberOfEMIs: dev.emis,
      loanAmount: loanAmount,
      emiAmount: emiAmount,
      amountPaid: amountPaid,
      amountLeft: amountLeft,
      installmentsPaid: installmentsPaid,
      firstEmiDate: firstEmiDate,
      emiStartDate: firstEmiDate,
      emiEndDate: new Date(firstEmiDate.getTime() + dev.emis * 30 * 24 * 3600 * 1000),
      financer: "admin",
      paymentOptions: "upi",
      loanStatus: loanStatus,
      deviceUnlockStatus: deviceUnlockStatus,
      installments: installments,
      shopName: "V-Credit Retail Partner",
      devicePolicy: {
        isResetAllowed: loanStatus === "CLOSED",
        isUninstallAllowed: false,
        isWallpaperEnabled: deviceUnlockStatus === "LOCKED",
        wallpaperUrl: deviceUnlockStatus === "LOCKED" ? "https://vcredit.in/overdue-lock.jpg" : "",
        isVoiceReminderEnabled: deviceUnlockStatus === "LOCKED",
        isWhatsAppBlocked: deviceUnlockStatus === "LOCKED",
      },
    };

    createdLoans.push(loanDoc);
  }

  await Loan.insertMany(createdLoans);
  console.log(`Successfully seeded ${createdLoans.length} CustomerLoan records linked across all dealers and customers!`);

  await mongoose.disconnect();
}

seedLoans().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
