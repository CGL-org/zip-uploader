// index.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import AdmZip from "adm-zip";

dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "Receive_Files";
const EXTRACTED_BUCKET = "Extracted_Files";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session for login
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer config (upload to memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB
});

// Get file list
async function getFileList() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(error.message);

  return data.map((f) => {
    const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
    return { ...f, publicUrl: g?.data?.publicUrl || null };
  });
}

// Middleware to protect pages
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Login page
app.get("/login", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Login</title>
    <style>
      body {
        display:flex; align-items:center; justify-content:center;
        height:100vh; margin:0; font-family:Arial, sans-serif;
        background:linear-gradient(135deg,#009688,#4db6ac);
      }
      .login-box {
        background:rgba(255,255,255,0.2); padding:30px; border-radius:12px;
        backdrop-filter:blur(10px); box-shadow:0 4px 12px rgba(0,0,0,0.3);
        width:300px; text-align:center; color:#fff;
      }
      input {
        width:90%; padding:10px; margin:10px 0;
        border:none; border-radius:6px; outline:none;
      }
      button {
        width:100%; padding:10px; background:#004d40; color:#fff;
        border:none; border-radius:6px; cursor:pointer;
      }
      button:hover { background:#00332c; }
    </style>
  </head>
  <body>
    <div class="login-box">
      <h2>🔐 Admin Login</h2>
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="Username" required /><br/>
        <input type="password" name="password" placeholder="Password" required /><br/>
        <button type="submit">Login</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

// Handle login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "1234") {
    req.session.user = { username };
    return res.redirect("/");
  }
  res.send("<h3>❌ Invalid credentials. <a href='/login'>Try again</a></h3>");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Home Page (Dashboard)
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.send(`
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { margin:0; font-family: Arial; background: #f4f6f9; }
        .sidebar {
          position:fixed; top:0; left:-220px; width:200px; height:100%;
          background:#004d40; color:white; padding-top:60px;
          transition:0.3s; overflow:hidden;
        }
        .sidebar a {
          display:block; padding:12px; color:white;
          text-decoration:none; font-weight:500;
        }
        .sidebar a:hover { background:#00796b; }
        #menuBtn {
          position:fixed; top:20px; left:10px;
          background:#004d40; color:white; border:none;
          border-radius:50%; width:40px; height:40px;
          cursor:pointer; z-index:1000;
        }
        .content { margin-left:20px; padding:20px; }
        .table-wrapper { overflow-x:auto; }
        table { width:100%; border-collapse:collapse; }
        thead { background:#009688; color:#fff; }
        th, td { padding:12px; border-bottom:1px solid #ddd; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        a { color:#009688; text-decoration:none; }
        a:hover { text-decoration:underline; }
      </style>
    </head>
    <body>
      <button id="menuBtn">☰</button>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="#">➕ Create Account</a>
        <a href="#">✏ Update Account</a>
        <a href="#">🗑 Delete Account</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h1>Admin Dashboard</h1>
        <p>Welcome, ${req.session.user.username}</p>
        <p>📂 Bucket: <strong>${BUCKET}</strong></p>

        <h2>Stored Files</h2>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Size</th><th>Last Modified</th><th>Action</th></tr>
            </thead>
            <tbody>
            ${files.map(f => `
              <tr>
                <td>${f.name}</td>
                <td>${f.metadata?.mimetype || "N/A"}</td>
                <td>${f.metadata?.size || "?"} bytes</td>
                <td>${f.updated_at || "N/A"}</td>
                <td>${f.name.endsWith(".zip") 
                  ? `<a href="/extract/${encodeURIComponent(f.name)}">Extract</a>` 
                  : "-"}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        const sidebar=document.getElementById("sidebar");
        const btn=document.getElementById("menuBtn");
        let open=false;
        btn.onclick=()=>{ 
          if(open){ sidebar.style.left="-220px"; btn.innerText="☰"; open=false; }
          else{ sidebar.style.left="0"; btn.innerText="←"; open=true; }
        }
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extract ZIP into another bucket
app.get("/extract/:fileName", requireLogin, async (req, res) => {
  const fileName = req.params.fileName;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(fileName);
    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());
    const zip = new AdmZip(buffer);

    const zipBase = fileName.replace(/\.zip$/i, "");
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const filePath = `${zipBase}/${entry.entryName}`;
      const content = entry.getData();

      const { error: upErr } = await supabase.storage
        .from(EXTRACTED_BUCKET)
        .upload(filePath, content, { upsert: true });
      if (upErr) throw upErr;
    }

    res.send(`<h3>✅ Extracted ${fileName} into ${EXTRACTED_BUCKET}/${zipBase} <br><a href="/">⬅ Back</a></h3>`);
  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).send("Error extracting: " + err.message);
  }
});

// Upload ZIP only
app.post("/upload-zip", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file attached (field name = file)" });
  try {
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, fileBuffer, {
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

// Mount extracted routes separately
import extractedRoutes from "./routes/extracted.js";
app.use("/extracted", requireLogin, extractedRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
