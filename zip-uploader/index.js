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

// Session
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB
});

// Helpers
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

async function getExtractedFolders() {
  const { data, error } = await supabase.storage
    .from(EXTRACTED_BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  return data.filter((f) => f.metadata === null); // only folders
}

async function getExtractedFiles(folder) {
  const { data, error } = await supabase.storage
    .from(EXTRACTED_BUCKET)
    .list(folder, { limit: 1000 });
  if (error) throw new Error(error.message);

  return data.map((f) => {
    const g = supabase.storage.from(EXTRACTED_BUCKET).getPublicUrl(`${folder}/${f.name}`);
    return { ...f, publicUrl: g?.data?.publicUrl || null };
  });
}

// Auth middleware
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Login
app.get("/login", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Login</title>
    <style>
      body {
        margin:0; height:100vh; display:flex; justify-content:center; align-items:center;
        font-family: Arial, sans-serif; background: linear-gradient(135deg,#003c2f,#0a5f47);
      }
      .login-box {
        width: 350px; padding: 30px; border-radius: 15px;
        background: rgba(255,255,255,0.15); backdrop-filter: blur(15px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); color: #fff; text-align:center;
      }
      h2 { margin-bottom: 20px; }
      input {
        width:100%; padding:12px; margin:10px 0; border:none; border-radius:8px;
        background: rgba(255,255,255,0.2); color:#fff; font-size:1em; outline:none;
      }
      input::placeholder { color:#ddd; }
      button {
        width:100%; padding:12px; border:none; border-radius:8px;
        background:#00b894; color:#fff; font-size:1em; cursor:pointer; transition:0.3s;
      }
      button:hover { background:#019874; }
    </style>
  </head>
  <body>
    <div class="login-box">
      <h2>Admin Login</h2>
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="Username" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "1234") {
    req.session.user = { username };
    return res.redirect("/");
  }
  res.send("<h3>❌ Invalid credentials. <a href='/login'>Try again</a></h3>");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Home (Receive_Files)
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.send(`
    <html>
    <head>
      <title>Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { margin:0; font-family: "Segoe UI", sans-serif; background:#f4f6f9; color:#333; }
        .header { background:#009688; color:#fff; padding:15px 25px; box-shadow:0 2px 6px rgba(0,0,0,0.15); }
        .header h1 { margin:0; font-size:1.4rem; }
        .content { padding:30px; }
        .card { background:#fff; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.08); padding:20px; margin-bottom:20px; }
        .card h2 { margin-top:0; font-size:1.2rem; color:#009688; }
        table { width:100%; border-collapse:collapse; font-size:0.95em; }
        thead { background:#009688; color:#fff; }
        th, td { padding:12px 15px; border-bottom:1px solid #ddd; }
        tbody tr:nth-child(even){ background:#f9f9f9; }
        tbody tr:hover{ background:#f1f7f7; }
        a { color:#009688; font-weight:500; text-decoration:none; }
      </style>
    </head>
    <body>
      <div class="header"><h1>Admin Dashboard</h1></div>
      <div class="content">
        <div class="card"><h2>Welcome, ${req.session.user.username}</h2></div>
        <div class="card">
          <h2>Stored Zip Files</h2>
          <table>
            <thead><tr><th>Name</th><th>Action</th></tr></thead>
            <tbody>
              ${files.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td><a href="/extract/${encodeURIComponent(f.name)}">Extract</a></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <a href="/extracted">📂 View Extracted Files</a>
      </div>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extract ZIP
app.get("/extract/:file", requireLogin, async (req, res) => {
  const fileName = req.params.file;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(fileName);
    if (error) throw error;

    const zip = new AdmZip(await data.arrayBuffer());
    const folderName = fileName.replace(/\.zip$/i, "");

    for (const entry of zip.getEntries()) {
      if (!entry.isDirectory) {
        const { error: uploadError } = await supabase.storage
          .from(EXTRACTED_BUCKET)
          .upload(`${folderName}/${entry.entryName}`, entry.getData(), {
            upsert: true,
            contentType: "application/octet-stream",
          });
        if (uploadError) throw uploadError;
      }
    }

    res.send(`<h3>✅ Extracted to ${EXTRACTED_BUCKET}/${folderName}. <a href="/extracted">View Extracted</a></h3>`);
  } catch (err) {
    res.status(500).send("❌ Extraction failed: " + err.message);
  }
});

// Extracted files page
app.get("/extracted", requireLogin, async (req, res) => {
  try {
    const folders = await getExtractedFolders();
    res.send(`
    <html>
    <head>
      <title>Extracted Files</title>
      <style>
        body { margin:0; font-family:"Segoe UI",sans-serif; background:#eef1f5; }
        .header{ background:#009688; color:#fff; padding:15px 25px; }
        .grid{ display:flex; flex-wrap:wrap; gap:20px; padding:20px; }
        .folder{ background:#fff; padding:20px; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.1); cursor:pointer; transition:transform 0.2s; }
        .folder:hover{ transform:scale(1.05); background:#f0fffb; }
        .modal{ display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(5px); justify-content:center; align-items:center; }
        .modal-content{ background:#fff; padding:20px; border-radius:12px; max-width:80%; max-height:80%; overflow:auto; }
        .close{ float:right; cursor:pointer; font-size:20px; }
        a { color:#009688; text-decoration:none; }
      </style>
    </head>
    <body>
      <div class="header"><h1>Extracted Files</h1></div>
      <div class="grid">
        ${folders.map(f => `<div class="folder" onclick="openFolder('${f.name}')">📂 ${f.name}</div>`).join('')}
      </div>

      <div class="modal" id="modal">
        <div class="modal-content">
          <span class="close" onclick="closeModal()">&times;</span>
          <h2 id="modalTitle"></h2>
          <ul id="fileList"></ul>
        </div>
      </div>

      <script>
        async function openFolder(folder){
          const res = await fetch('/extracted/' + folder);
          const data = await res.json();
          document.getElementById('modalTitle').innerText = folder;
          const list = document.getElementById('fileList');
          list.innerHTML = data.files.map(f => 
            '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>'
          ).join('');
          document.getElementById('modal').style.display='flex';
        }
        function closeModal(){ document.getElementById('modal').style.display='none'; }
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).send("❌ Error loading extracted files: " + err.message);
  }
});

// Get files in a folder
app.get("/extracted/:folder", requireLogin, async (req, res) => {
  try {
    const files = await getExtractedFiles(req.params.folder);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload ZIP
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
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
