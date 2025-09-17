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

// 🔄 Function to get file list
async function getFileList() {
  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });

  if (error) throw new Error(error.message);

  return data.map((f) => {
    const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
    return { ...f, publicUrl: g?.data?.publicUrl || null };
  });
}

// ✅ Root route → now shows bucket contents
app.get("/", async (req, res) => {
  try {
    const files = await getFileList();
       let html = `
      <html>
      <head>
        <title>Bucket Files</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #fff; }
          th, td { padding: 10px; border: 1px solid #ccc; text-align: left; }
          th { background: #eee; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>📂 Files in Bucket: ${BUCKET}</h1>
        <table>
          <tr><th>Name</th><th>Type</th><th>Size</th><th>Last Modified</th><th>Link</th></tr>
    `;

    files.forEach(file => {
      html += `
        <tr>
          <td>${file.name}</td>
          <td>${file.metadata?.mimetype || "N/A"}</td>
          <td>${file.metadata?.size || "?"} bytes</td>
          <td>${file.updated_at || "N/A"}</td>
          <td><a href="${file.publicUrl}" target="_blank">Open</a></td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ✅ List files (still available)
app.get("/files", async (req, res) => {
  try {
    const files = await getFileList();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server listening on port ${PORT}`)
);
