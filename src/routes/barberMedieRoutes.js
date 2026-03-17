import express from"express";
const router = express.Router();

import db from "../db/db.js";
import { getCustomer } from "../services/memoryService.js";


// Import upload middleware
const upload = require("../middleware/uploadMiddleware");

/*
========================================
UPLOAD BARBER MEDIA
========================================
POST /api/barbers/upload-media
*/
router.post("/upload-media", upload.single("media"), (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: "File uploaded successfully",
      mediaUrl: fileUrl
    });

  } catch (error) {

    console.error("Upload error:", error);

    res.status(500).json({
      success: false,
      message: "Upload failed"
    });

  }
});

export default router
