const admin = require("firebase-admin");

// Check if ALL environment variables are available (Production/Render)
const hasEnvVars =
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL;

if (hasEnvVars) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Handle newlines in env vars
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
} else {
  // Fallback to local file (Development)
  try {
    const fs = require("fs");
    const path = require("path");
    const serviceAccountPath = path.join(
      process.cwd(),
      "secrets",
      "serviceAccountKey.json",
    );

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf8"),
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.error(
        "Firebase Admin: Service account file not found and Env vars not set.",
      );
    }
  } catch (error) {
    console.error("Firebase Admin Error:", error);
  }
}

module.exports = admin;
