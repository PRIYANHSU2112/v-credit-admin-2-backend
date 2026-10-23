// Render, cPanel / Passenger, and other hosts may start via `node index.js`.
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

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
dotenv.config();

require("./server.js");
