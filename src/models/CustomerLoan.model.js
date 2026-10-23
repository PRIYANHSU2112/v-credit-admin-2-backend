const mongoose = require("mongoose");

const customerloanSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountLeft: {
      type: Number,
      default: 0,
    },
    installmentsPaid: {
      type: Number,
      default: 0,
    },
    installationType: {
      type: String,
      enum: ["New Phone", "Old/Running Phone"],
    },
    mobileBrand: {
      type: String,
    },
    mobileModel: {
      type: String,
    },
    imeiNumber1: {
      type: String,
      unique: true,
    },
    imeiNumber2: {
      type: String,
    },
    mobilePrice: {
      type: Number,
    },
    processingFees: {
      type: Number,
      default: 0,
    },
    downPayment: {
      type: Number,
      default: 0,
    },
    frequency: {
      type: String,
      enum: ["monthly", "weekly", "daily"],
      default: "monthly",
    },
    numberOfEMIs: {
      type: Number,
      default: 0,
    },
    interestRate: {
      type: Number,
      default: 0,
    },
    loanAmount: {
      type: Number,
    },
    emiAmount: {
      type: Number,
    },
    firstEmiDate: {
      type: Date,
    },
    financer: {
      type: String,
      enum: ["admin", "shop owner"],
    },
    paymentOptions: {
      type: String,
      enum: ["cash", "upi", "autopay/autodebit"],
    },
    description: {
      type: String,
    },
    autoUnlock: {
      type: Boolean,
      default: false,
    },
    emiStartDate: {
      type: Date,
    },
    emiEndDate: {
      type: Date,
    },
    loanStatus: {
      type: String,
      enum: ["APPROVED", "PENDING", "REJECTED", "CLOSED"],
      default: "PENDING",
    },
    overdueDaysToLock: {
      type: Number,
      default: 1,
    },
    deviceUnlockStatus: {
      type: String,
      enum: ["LOCKED", "UNLOCKED"],
      default: "UNLOCKED",
    },
    manualUnlockTimestamp: {
      type: Date,
    },
    installments: [
      {
        installmentNumber: {
          type: Number,
        },
        dueDate: {
          type: Date,
        },
        amount: {
          type: Number,
        },
        status: {
          type: String,
          enum: ["PENDING", "PAID", "OVERDUE", "PARTIAL"],
          default: "PENDING",
        },
        paidAmount: {
          type: Number,
          default: 0,
        },
        paidDate: {
          type: Date,
        },
        paymentMethod: {
          type: String,
          enum: ["cash", "upi", "autopay/autodebit"],
        },
        lateFee: {
          type: Number,
          default: 0,
        },
        bounceFee: {
          type: Number,
          default: 0,
        },
        remarks: {
          type: String,
        },
      },
    ],
    devicePolicy: {
      isResetAllowed: { type: Boolean, default: false },
      isUninstallAllowed: { type: Boolean, default: false },
      // Dealer/org Google account id(s) bound as Factory Reset Protection so a
      // wiped device still demands these accounts before it can be set up.
      frpAccounts: { type: [String], default: [] },
      isDeveloperOptionsBlocked: { type: Boolean, default: false },
      isWallpaperEnabled: { type: Boolean, default: false },
      wallpaperUrl: { type: String, default: "" },
      isWhatsAppBlocked: { type: Boolean },
      isInstagramBlocked: { type: Boolean },
      isSnapchatBlocked: { type: Boolean },
      isYouTubeBlocked: { type: Boolean },
      isFacebookBlocked: { type: Boolean },
      isDialerBlocked: { type: Boolean },
      isMessagesBlocked: { type: Boolean },
      isPlayStoreBlocked: { type: Boolean },
      isChromeBlocked: { type: Boolean },
      isVoiceReminderEnabled: { type: Boolean },
      isLocationEnabled: { type: Boolean, default: true }, // Added for remote location control
    },
    shopName: {
      type: String,
      default: "Satya Kabir E-solutions Pvt. Ltd.",
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
    requestLocation: {
      type: Boolean,
      default: false,
    },
    requestSimInfo: {
      type: Boolean,
      default: false,
    },
    simDetails: [
      {
        slotIndex: Number,
        subscriptionId: Number,
        carrierName: String,
        iccid: String,
        number: String,
        countryIso: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Decrement the creator's key balance ONLY when a loan is first created.
// Previously this ran on every save (status updates, EMI payments, etc.),
// causing repeated/erroneous decrements. The `this.isNew` guard fixes that.
customerloanSchema.pre("save", async function (next) {
  try {
    if (!this.isNew) return next();

    const userId = this.createdBy;
    if (!userId) return next();

    await mongoose
      .model("User")
      .findOneAndUpdate({ _id: userId }, { $inc: { keys: -1 } }, { new: true });

    next();
  } catch (err) {
    next(err);
  }
});

const Loan = mongoose.model("Loan", customerloanSchema);

module.exports = Loan;
