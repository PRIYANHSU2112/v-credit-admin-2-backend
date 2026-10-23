const mongoose = require("mongoose");
// Supertest removed
// Actually, let's use the local controller/middleware simulation or just extensive logging since we are running locally.
// Better: Use a simple script with axios/fetch against the RUNNING server (localhost:3000).

const axios = require("axios");

async function verifyAccessControl() {
  const BASE_URL = "http://localhost:3000/api";
  const CUSTOMER_PHONE = "9000000001";
  const OTP = "1234";

  console.log("--- STARTING ACCESS CONTROL TEST ---");

  try {
    // 0. Send OTP First
    console.log(`0. Sending OTP to Customer (${CUSTOMER_PHONE})...`);
    try {
      await axios.post(`${BASE_URL}/auth/send-otp`, {
        phone: CUSTOMER_PHONE,
        type: "login",
      });
    } catch (e) {
      if (e.response && e.response.status === 429) {
        console.log("   (OTP Rate Limit hit, proceeding assuming 1234)...");
      } else {
        throw e;
      }
    }

    // 1. Login as Customer
    console.log(`1. Logging in as Customer (${CUSTOMER_PHONE})...`);
    const loginRes = await axios.post(`${BASE_URL}/auth/verify-otp`, {
      phone: CUSTOMER_PHONE,
      otpCode: OTP,
    });

    if (!loginRes.data.success) {
      console.error("Login Failed:", loginRes.data);
      return;
    }

    const token = loginRes.data.data.token;
    console.log("   Login Successful. Token received:", token);

    // 2. Attempt Admin Action (Get All Users)
    console.log("\n2. Attempting ADMIN Action (Get All Users)...");
    try {
      await axios.get(`${BASE_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.error(
        "   FAILED! Customer was able to access Admin Route (Status 200). Protocol Breach."
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log("   SUCCESS! Request was BLOCKED.");
        console.log(
          `   Server responded: ${error.response.status} ${error.response.statusText}`
        );
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.error(
          "   Unexpected Error:",
          error.message,
          error.response?.status
        );
      }
    }

    // 3. Attempt Admin Action (Delete User - dummy ID)
    console.log("\n3. Attempting ADMIN Action (Delete User)...");
    try {
      await axios.delete(`${BASE_URL}/user/65b1234567890abcdef12345`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.error(
        "   FAILED! Customer was able to call Delete User. Protocol Breach."
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log("   SUCCESS! Request was BLOCKED.");
        console.log(
          `   Server responded: ${error.response.status} ${error.response.statusText}`
        );
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.error(
          "   Unexpected Error:",
          error.message,
          error.response?.status
        );
      }
    }
  } catch (error) {
    console.error("Test Error:", error.message);
    if (error.response) {
      console.error("   Response Code:", error.response.status);
      console.error("   Response Data:", error.response.data);
    }
    if (error.code === "ECONNREFUSED") {
      console.error("   Is the server running on localhost:3000?");
    }
  }
  console.log("\n--- TEST COMPLETE ---");
}

verifyAccessControl();
