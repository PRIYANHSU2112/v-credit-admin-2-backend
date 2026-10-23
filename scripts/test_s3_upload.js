require("dotenv").config();
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const s3Client = new S3Client({
  endpoint: process.env.LINODE_OBJECT_STORAGE_ENDPOINT,
  region: process.env.LINODE_OBJECT_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // DigitalOcean Spaces standard domain style
});

async function testUpload() {
  const bucketName = process.env.LINODE_OBJECT_BUCKET;
  const folderPath = process.env.BUCKET_FOLDER_PATH || "VlockerApp/";
  const fileName = `test_image_${Date.now()}.png`;
  const objectKey = `${folderPath}${fileName}`;

  // 1x1 transparent PNG base64
  const sampleImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const imageBuffer = Buffer.from(sampleImageBase64, "base64");

  console.log("------------------------------------------------");
  console.log("Testing Object Storage S3 Upload:");
  console.log("Endpoint:", process.env.LINODE_OBJECT_STORAGE_ENDPOINT);
  console.log("Region:", process.env.LINODE_OBJECT_STORAGE_REGION);
  console.log("Bucket:", bucketName);
  console.log("Object Key:", objectKey);
  console.log("------------------------------------------------");

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: imageBuffer,
      ContentType: "image/png",
      ACL: "public-read",
    });

    const response = await s3Client.send(command);
    console.log("Upload Success! HTTP Status:", response.$metadata.httpStatusCode);

    const publicUrl = `https://${bucketName}.${process.env.LINODE_OBJECT_STORAGE_REGION}.digitaloceanspaces.com/${objectKey}`;
    console.log("Uploaded Image Public URL:", publicUrl);

    // Verify object header
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const headResponse = await s3Client.send(headCommand);
    console.log("HeadObject Verification Successful! ContentType:", headResponse.ContentType);
    console.log("SUCCESS: Image upload test passed perfectly!");
  } catch (error) {
    console.error("ERROR uploading image:", error.message);
    console.error(error);
  }
}

testUpload();
