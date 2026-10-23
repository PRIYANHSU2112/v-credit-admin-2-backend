const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const addressRoutes = require("./routes/CustomerAddress.routes");
const bankRoutes = require("./routes/CustomerBank.routes");
const customerRoutes = require("./routes/customer.routes");
const customerLoan = require("./routes/CustomerLoan.routes");
const feedbackRoutes = require("./routes/Feedback.routes");
const InstallationVideoRoutes = require("./routes/InstallationVideo.routes");
const companySupportRoutes = require("./routes/Company.routes");
const homeRoutes = require("./routes/Home.routes");
const contactusRoutes = require("./routes/ContactUs.routes");
const stateRoutes = require("./routes/State.routes");
const cityRoutes = require("./routes/City.routes");
const mobileBrandRoutes = require("./routes/MobileBrand.routes");
const mobileModelRoutes = require("./routes/MobileModel.routes");
const keysRoutes = require("./routes/keys.routes");
const notification = require("./routes/Notification.routes");
const deviceRoutes = require("./routes/Device.routes");
const razorpayRoutes = require("./routes/Razorpay.routes");

const app = express();

const isDev = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDev ? 5000 : 300,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
    });
  },
});
// Behind a reverse proxy (nginx/render/etc.) so req.ip / rate-limit / secure cookies work correctly
app.set("trust proxy", 1);

// CORS: in production only allow whitelisted origins (comma separated in CORS_ORIGINS).
// In dev, reflect the request origin for convenience.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (mobile apps, curl) send no Origin — always allow.
      if (!origin) return callback(null, true);
      if (isDev || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Baseline security headers (lightweight, no extra dependency)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.removeHeader("X-Powered-By");
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(limiter);
app.get(["/VLocker.apk", "/vlocker.apk", "/VLockerlatest.apk", "/uploads/Vlocker.apk", "/uploads/VLocker.apk", "/uploads/vlocker-release.apk"], (req, res) => {
  res.sendFile(path.join(__dirname, "../public/VLocker.apk"));
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/customerLoan", customerLoan);
app.use("/api/address", addressRoutes);
app.use("/api/bank", bankRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/contactUs", contactusRoutes);

app.use("/api/states", stateRoutes);
app.use("/api/cities", cityRoutes);

app.use("/api/mobile-brands", mobileBrandRoutes);
app.use("/api/mobile-models", mobileModelRoutes);

app.use("/api/upload", InstallationVideoRoutes);
app.use("/api/keys", keysRoutes);
app.use("/api/enterprise", require("./routes/enterprise.routes"));
app.use("/api/notification", notification);
app.use("/api/device", deviceRoutes);
app.use("/api/mobile", require("./routes/mobile.routes"));
app.use("/api/mdm", require("./routes/mdm.routes"));
app.use("/api/payment", razorpayRoutes);
app.use("/api/provisioning", require("./routes/provisioning.routes"));

app.use("/api/company", companySupportRoutes);
app.use("/api/leads", require("./routes/leads.routes"));
app.get("/", (req, res) => {
  res.send("Welcome to V Locker App API");
});

// 404 for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler — prevents unhandled errors from crashing the process
// and stops stack traces leaking to clients in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: isDev ? err.message : "Something went wrong",
  });
});

module.exports = app;
