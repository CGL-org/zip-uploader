// index.js
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";

// Routes
import extractedRoutes from "./routes/extracted.js";
import doneRoutes from "./routes/done.js";
import accountRoutes from "./routes/account.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase environment variables!");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Multer setup
const upload = multer({ dest: "uploads/" });

// Middleware to check if logged in
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Serve static files
app.use("/uploads", express.static("uploads"));

// Login page
app.get("/login", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Login</title>
      <style>
        body { 
          font-family: Arial; 
          background: url('https://source.unsplash.com/1600x900/?technology') no-repeat center center fixed; 
          background-size: cover;
          margin: 0;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh;
        }
        .login-box {
          background: rgba(255,255,255,0.15);
          padding: 25px;
          border-radius: 15px;
          box-shadow: 0 4px 30px rgba(0,0,0,0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          width: 300px;
          text-align: center;
        }
        .login-box h2 { color: white; }
        .login-box input {
          width: 90%;
          padding: 10px;
          margin: 8px 0;
          border: none;
          border-radius: 8px;
          background: rgba(255,255,255,0.3);
          color: #fff;
          font-size: 14px;
        }
        .login-box input::placeholder { color: #eee; }
        .login-box button {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 8px;
          background: #004d40;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }
        .login-box button:hover { background: #00695c; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>Admin Login</h2>
        <form method="POST" action="/login">
          <input type="text" name="username" placeholder="Username" required /><br>
          <input type="password" name="password" placeholder="Password" required /><br>
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const { data: user, error } = await supabase.from("users").select("*").eq("username", username).single();
    if (error || !user) return res.status(401).send("Invalid credentials");

    const valid = await bcrypt.compare(password, user.password || user.password_hash || "");
    if (!valid) return res.status(401).send("Invalid credentials");

    // store the user row in session (strip password fields)
    delete user.password;
    delete user.password_hash;
    req.session.user = user;
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Dashboard
app.get("/", requireLogin, async (req, res) => {
  try {
    const { user } = req.session;

    // ✅ Count files by status (using exact status strings)
    // Using destructured response to capture count safely
    let receiveCount = 0, extractedCount = 0, completedCount = 0;
    try {
      const r1 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Receive_Files");
      receiveCount = (r1 && r1.count) ? r1.count : 0;
    } catch (e) {
      console.warn("count Receive_Files err", e.message || e);
      receiveCount = 0;
    }

    try {
      const r2 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Extracted_Files");
      extractedCount = (r2 && r2.count) ? r2.count : 0;
    } catch (e) {
      console.warn("count Extracted_Files err", e.message || e);
      extractedCount = 0;
    }

    try {
      const r3 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Completed");
      completedCount = (r3 && r3.count) ? r3.count : 0;
    } catch (e) {
      console.warn("count Completed err", e.message || e);
      completedCount = 0;
    }

    // Users count only when admin
    let usersCount = 0;
    const isAdmin = (user && (user.user_type === "admin" || user.username === "admin" || user.role === "admin"));
    if (isAdmin) {
      try {
        const ru = await supabase.from("users").select("*", { count: "exact", head: true });
        usersCount = (ru && ru.count) ? ru.count : 0;
      } catch (e) {
        console.warn("count users err", e.message || e);
        usersCount = 0;
      }
    }

    // Fetch stored files to show in the table
    let files = [];
    try {
      const { data: filesData, error: filesErr } = await supabase.from("storefile").select("*").order("created_at", { ascending: false });
      if (filesErr) throw filesErr;
      files = filesData || [];
    } catch (e) {
      console.warn("fetch storefile rows err", e.message || e);
      files = [];
    }

    res.send(`
      <html>
      <head>
        <title>Dashboard</title>
        <style>
          body { margin:0; font-family: Arial; background:#f4f6f9; }
          header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
          .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; }
          .sidebar.active { left:0; }
          .sidebar a { display:block; padding:14px 18px; color:white; text-decoration:none; font-weight:500; transition:0.2s; }
          .sidebar a:hover { background:#00796b; padding-left:25px; }
          #menuBtn { position: fixed; top:15px; left:15px; background:#00796b; color:white; border:none; padding:10px 14px; border-radius:6px; cursor:pointer; font-size:1em; z-index:1001; }
          .content { padding:20px; margin-left:0; transition: margin-left 0.3s; }
          .content.active { margin-left:220px; }

          /* Info boxes */
          .info-boxes { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin-bottom:20px; }
          .info-card { padding:20px; border-radius:12px; color:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.15); text-align:left; }
          .info-card h3 { margin:0; font-size:1rem; opacity:0.9; }
          .info-card p { margin:8px 0 0; font-size:1.6rem; font-weight:700; }

          .card-receive { background: linear-gradient(135deg,#00695c,#009688); }
          .card-extracted { background: linear-gradient(135deg,#1e88e5,#42a5f5); }
          .card-completed { background: linear-gradient(135deg,#f9a825,#ffca28); color:rgba(0,0,0,0.85); }
          .card-users { background: linear-gradient(135deg,#8e24aa,#d81b60); }

          /* Table */
          table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:10px; }
          thead { background:#009688; color:white; }
          th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
          tbody tr:nth-child(even) { background:#f9f9f9; }

          /* Search bar */
          #searchInput {
            width: 100%;
            padding: 10px;
            margin-bottom: 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-sizing: border-box;
          }

          @media (max-width:720px){
            .info-boxes { grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); }
          }
        </style>
      </head>
      <body>
        <header>📊 File Management Portal</header>
        <button id="menuBtn">☰ Menu</button>
        <div class="sidebar" id="sidebar">
          <a href="/">🏠 Dashboard</a>
          <a href="/extracted">📂 Extracted Files</a>
          <a href="/done">✅ Completed</a>
          <a href="/account">👤 Account</a>
          <a href="/logout">🚪 Logout</a>
        </div>

        <div class="content" id="mainContent">
          <div class="info-boxes" role="region" aria-label="Stats">
            <div class="info-card card-receive"><h3>📥 Received Files</h3><p id="rcount">${receiveCount ?? 0}</p></div>
            <div class="info-card card-extracted"><h3>📂 Extracted Files</h3><p id="ecount">${extractedCount ?? 0}</p></div>
            <div class="info-card card-completed"><h3>✅ Completed</h3><p id="ccount">${completedCount ?? 0}</p></div>
            ${isAdmin ? `<div class="info-card card-users"><h3>👥 Users</h3><p id="ucount">${usersCount ?? 0}</p></div>` : ''}
          </div>

          <h2>📁 Stored Files</h2>
          <!-- SEARCH BAR (above the table) -->
          <input type="text" id="searchInput" placeholder="🔍 Live search across all columns (type to filter)">

          <table id="fileTable" aria-describedby="searchInput">
            <thead>
              <tr><th>File Name</th><th>Status</th><th>Uploaded At</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${files.map(f => `
                <tr>
                  <td>${escapeHtml(String(f.filename || f.name || ""))}</td>
                  <td>${escapeHtml(String(f.status || ""))}</td>
                  <td>${escapeHtml(String(f.created_at || f.updated_at || ""))}</td>
                  <td>${(String(f.filename || f.name || "").endsWith(".zip")) ? `<a href="/extract/${encodeURIComponent(f.filename || f.name)}">Extract</a>` : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <script>
          // small helper to escape textContent when building rows client-side (not strictly necessary here)
          function escapeHtml(text) {
            return text.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
          }

          const menuBtn = document.getElementById("menuBtn");
          const sidebar = document.getElementById("sidebar");
          const content = document.getElementById("mainContent");
          menuBtn.addEventListener("click", () => {
            const isOpen = sidebar.classList.contains("active");
            sidebar.classList.toggle("active", !isOpen);
            content.classList.toggle("active", !isOpen);
          });

          // Live search (filters all columns)
          const searchInput = document.getElementById("searchInput");
          if (searchInput) {
            searchInput.addEventListener("input", function() {
              const filter = this.value.trim().toLowerCase();
              const rows = document.querySelectorAll("#fileTable tbody tr");
              rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = filter === "" ? "" : (text.indexOf(filter) > -1 ? "" : "none");
              });
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// Extract file route
app.get("/extract/:fileName", requireLogin, async (req, res) => {
  try {
    const { fileName } = req.params;
    const { data, error } = await supabase.storage
      .from("Receive_Files")
      .download(fileName);
    if (error) throw error;

    const filePath = path.join("uploads", fileName);
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const zip = new AdmZip(filePath);
    zip.extractAllTo("uploads/extracted", true);

    await supabase
      .from("storefile")
      .update({ status: "Extracted_Files" })
      .eq("filename", fileName);

    res.send("File extracted successfully");
  } catch (err) {
    res.status(500).send("Error extracting file: " + err.message);
  }
});

// Upload route
app.post("/upload-zip", upload.single("file"), requireLogin, async (req, res) => {
  try {
    const { file } = req;
    const fileBuffer = fs.readFileSync(file.path);

    const { error } = await supabase.storage
      .from("Receive_Files")
      .upload(file.originalname, fileBuffer, { upsert: true });

    if (error) throw error;

    await supabase.from("storefile").insert([
      { filename: file.originalname, status: "Receive_Files" },
    ]);

    fs.unlinkSync(file.path);

    res.send("File uploaded successfully");
  } catch (err) {
    res.status(500).send("Error uploading file: " + err.message);
  }
});

// Routes
app.use("/extracted", requireLogin, extractedRoutes);
app.use("/done", requireLogin, doneRoutes);
app.use("/account", requireLogin, accountRoutes);

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:\${PORT}`));

// ----------------- Utility (server-side escaping) -----------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
