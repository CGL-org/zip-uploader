// index.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import AdmZip from "adm-zip";
import extractedRoutes from "./routes/extracted.js";

dotenv.config();

// Supabase config
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

// Session
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// File list
async function getFileList() {
  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  return data.map((f) => {
    const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
    return { ...f, publicUrl: g?.data?.publicUrl || null };
  });
}

// Middleware for auth
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
        height:100vh; margin:0; font-family:Arial;
        background:linear-gradient(135deg,#009688,#4db6ac);
      }
      .login-box {
        background:rgba(255,255,255,0.2); padding:30px; border-radius:12px;
        backdrop-filter:blur(10px); box-shadow:0 4px 12px rgba(0,0,0,0.3);
        width:300px; text-align:center; color:#fff;
      }
      input { width:90%; padding:10px; margin:10px 0; border:none; border-radius:6px; }
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

// Dashboard
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.send(`
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { margin:0; font-family: Arial; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
        .sidebar {
          position:fixed; top:0; left:-220px; width:200px; height:100%;
          background:#004d40; color:white; padding-top:60px;
          transition:0.3s;
        }
        .sidebar a {
          display:block; padding:12px; color:white; text-decoration:none; font-weight:500;
        }
        .sidebar a:hover { background:#00796b; }
        #menuArrow {
          position:fixed; top:50%; left:0;
          background:#004d40; color:white; padding:8px;
          border-radius:0 5px 5px 0; cursor:pointer;
          z-index:1000;
        }
        .content { padding:20px; margin-left:20px; }
        table { width:100%; border-collapse:collapse; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        thead { background:#009688; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
      </style>
    </head>
    <body>
      <header>🏠 Admin Dashboard</header>
      <div id="menuArrow">➡</div>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="#">➕ Create Account</a>
        <a href="#">✏ Update Account</a>
        <a href="#">🗑 Delete Account</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h2>Stored Files</h2>
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

      <script>
        const menuArrow=document.getElementById("menuArrow");
        const sidebar=document.getElementById("sidebar");
        menuArrow.addEventListener("click",()=> {
          sidebar.classList.toggle("active");
          if(sidebar.classList.contains("active")) {
            sidebar.style.left="0";
            menuArrow.style.display="none";
          } else {
            sidebar.style.left="-220px";
            menuArrow.style.display="block";
          }
        });
        document.addEventListener("click",(e)=>{
          if(!sidebar.contains(e.target) && !menuArrow.contains(e.target)){
            sidebar.classList.remove("active");
            sidebar.style.left="-220px";
            menuArrow.style.display="block";
          }
        });
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extract ZIP into another bucket and delete original
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
      await supabase.storage.from(EXTRACTED_BUCKET).upload(filePath, content, { upsert: true });
    }

    // Delete original zip
    await supabase.storage.from(BUCKET).remove([fileName]);

    const metaFilePath = `${zipBase}/.extracted.json`;
    await supabase.storage.from(EXTRACTED_BUCKET).upload(
      metaFilePath,
      Buffer.from(JSON.stringify({ extractedAt: new Date().toISOString() })),
      { upsert: true, contentType: "application/json" }
    );
    
    res.redirect("/extracted");
  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).send("Error extracting: " + err.message);
  }
});

// Upload ZIP
app.post("/upload-zip", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file attached" });
  try {
    await supabase.storage.from(BUCKET).upload(req.file.originalname, req.file.buffer, {
      upsert: true,
      contentType: "application/zip",
    });
    res.json({ ok: true, uploaded: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount extracted routes
app.use("/extracted", requireLogin, extractedRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
