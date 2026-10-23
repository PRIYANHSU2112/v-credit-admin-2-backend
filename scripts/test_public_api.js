const axios = require("axios");

async function checkPublicStatus(imei) {
  try {
    const response = await axios.get(
      `http://localhost:3000/api/customerLoan/status/public?imei=${imei}`,
    );
    console.log(
      "Public Status Response:",
      JSON.stringify(response.data, null, 2),
    );
  } catch (error) {
    console.error("Error fetching public status:", error.message);
    if (error.response) {
      console.error("Response Data:", error.response.data);
    }
  }
}

const targetImei = process.argv[2] || "867400022047199_OLD_1771103907517";
checkPublicStatus(targetImei);
