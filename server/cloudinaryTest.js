import dotenv from "dotenv";
dotenv.config();
import cloudinary from "./libs/cloudinary.js";
(async () => {
  try {
    const res = await cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/sample.jpg"
    );
    console.log("✅ Upload success:", res.secure_url);
  } catch (err) {
    console.error("❌ Upload failed:", err.message);
  }
})();
