const jwt = require("jsonwebtoken");

const JWT_SECRET = "21478237473e8rwye89wrer";
const LOAN_ID = "695f9317f5f883300a5b0a7f";

// Generating token for a dummy admin.
// The backend authMiddleware just verifies the signature and role (if role check is enabled).
// It doesn't seem to check DB for existence unless specific logic enabled.
const dummyUserId = "507f1f77bcf86cd799439011";

const token = jwt.sign({ userId: dummyUserId, role: "admin" }, JWT_SECRET);

async function testLock() {
  try {
    console.log("Testing Lock Device with Loan ID:", LOAN_ID);
    console.log(
      "Target URL: http://localhost:3000/api/customerLoan/lock/" + LOAN_ID
    );

    const response = await fetch(
      `http://localhost:3000/api/customerLoan/lock/${LOAN_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Error Status:", response.status);
      console.log("Error Body:", errorText);
    } else {
      const data = await response.json();
      console.log("Success Response:", data);
    }
  } catch (error) {
    console.error("Fetch Error:", error.message);
  }
}

testLock();
