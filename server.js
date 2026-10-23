const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Explicitly load .env from __dirname for Phusion Passenger / cPanel / Docker / Render
const candidateEnvPaths = [
  path.resolve(__dirname, ".env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../.env"),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config(); // fallback

const app = require("./src/app");
const connectDB = require("./src/config/database");
const { runAutoLockScheduler } = require("./src/cron/scheduler");

const PORT = process.env.PORT || 3000;

connectDB();

// Start the scheduler
runAutoLockScheduler();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
