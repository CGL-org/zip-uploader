// index.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";

dotenv.config();

// 🔑 Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "Receive_Files";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();

// ✅ Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// 📂 Multer config (upload to memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB max
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 Zip uploader backend running → POST /upload-zip to upload");
});

// ✅ Upload ZIP only (no extraction)
app.post("/upload-zip", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file attached (field name = file)" });

  try {
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Upload .zip file to bucket
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, {
        upsert: true,
        contentType: "application/zip",
      });

    if (error) throw error;

    res.json({ ok: true, uploaded: fileName });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ List files in bucket
app.get("/files", async (req, res) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 1000 });

    if (error) return res.status(500).json({ error: error.message });

    const files = data.map((f) => {
      const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    console.error("❌ File list error", err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening on port ${PORT}`)
);
