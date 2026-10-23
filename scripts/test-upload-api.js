const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

async function testUpload() {
  try {
    const formData = new FormData();
    // Assuming there is some image in the directory or using a dummy file
    formData.append("file", fs.createReadStream("src/app.js"));

    const response = await axios.post(
      "http://localhost:3000/api/upload",
      formData,
      {
        headers: formData.getHeaders(),
      },
    );

    console.log("Upload Result:", response.data);
  } catch (error) {
    console.error(
      "Upload Error:",
      error.response ? error.response.data : error.message,
    );
  }
}

testUpload();
