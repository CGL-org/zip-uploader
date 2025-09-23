// index.js
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
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
    const { data: users, error } = await supabase.from("users").select("*").eq("username", username).single();
    if (error || !users) return res.status(401).send("Invalid credentials");

    const valid = await bcrypt.compare(password, users.password);
    if (!valid) return res.status(401).send("Invalid credentials");

    req.session.user = users;
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

    // ✅ Count files by status (using exact status strings you confirmed)
    let receiveCount = 0, extractedCount = 0, completedCount = 0;
    try {
      const r = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Receive_Files");
      receiveCount = Number(r?.count || 0);
    } catch (e) {
      console.warn("count Receive_Files error:", e.message || e);
      receiveCount = 0;
    }

    try {
      const r2 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Extracted_Files");
      extractedCount = Number(r2?.count || 0);
    } catch (e) {
      console.warn("count Extracted_Files error:", e.message || e);
      extractedCount = 0;
    }

    try {
      const r3 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Completed");
      completedCount = Number(r3?.count || 0);
    } catch (e) {
      console.warn("count Completed error:", e.message || e);
      completedCount = 0;
    }

    // Users count if admin (support both user_type or admin username)
    let usersCount = 0;
    const isAdmin = (user && (user.user_type === "admin" || user.username === "admin"));
    if (isAdmin) {
      try {
        const ru = await supabase.from("users").select("*", { count: "exact", head: true });
        usersCount = Number(ru?.count || 0);
      } catch (e) {
        console.warn("count users error:", e.message || e);
        usersCount = 0;
      }
    }

    // Fetch stored files (rows from storefile table)
    let files = [];
    try {
      const { data: sfdata, error: sferr } = await supabase.from("storefile").select("*").order("created_at", { ascending: false });
      if (sferr) throw sferr;
      files = sfdata || [];
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
          header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; position:sticky; top:0; z-index:100; }
          .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; }
          .sidebar.active { left:0; }
          .sidebar a { display:block; padding:14px 18px; color:white; text-decoration:none; font-weight:500; transition:0.2s; }
          .sidebar a:hover { background:#00796b; padding-left:25px; }
          #menuBtn { position: fixed; top:15px; left:15px; background:#00796b; color:white; border:none; padding:10px 14px; border-radius:6px; cursor:pointer; font-size:1em; z-index:1001; }
          .content { padding:20px; margin-left:0; transition: margin-left 0.3s; }
          .content.active { margin-left:220px; }

          /* Info boxes */
          .info-boxes { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin-bottom:20px; }
          .info-card { padding:18px; border-radius:12px; color:#fff; box-shadow:0 6px 18px rgba(0,0,0,0.06); min-height:86px; display:flex; flex-direction:column; justify-content:center; }
          .ic-receive { background: linear-gradient(135deg,#00695c,#009688); }
          .ic-extracted { background: linear-gradient(135deg,#1e88e5,#42a5f5); }
          .ic-completed { background: linear-gradient(135deg,#f9a825,#ffca28); color:rgba(0,0,0,0.85); }
          .ic-users { background: linear-gradient(135deg,#8e24aa,#d81b60); }
          .info-card .label { font-size:0.95rem; opacity:0.95; }
          .info-card .value { font-size:1.9rem; font-weight:700; margin-top:6px; }

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

          @media(max-width:768px){
            .info-boxes { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
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
          <div class="info-boxes">
            <div class="info-card ic-receive">
              <div class="label">📥 Received Files</div>
              <div class="value">${receiveCount}</div>
            </div>
            <div class="info-card ic-extracted">
              <div class="label">📂 Extracted Files</div>
              <div class="value">${extractedCount}</div>
            </div>
            <div class="info-card ic-completed">
              <div class="label">✅ Completed</div>
              <div class="value">${completedCount}</div>
            </div>
            ${isAdmin ? `<div class="info-card ic-users"><div class="label">👥 Users</div><div class="value">${usersCount}</div></div>` : ""}
          </div>

          <h2>📁 Stored Files</h2>

          <!-- Search input placed above the file table (live search) -->
          <input type="text" id="searchInput" placeholder="🔍 Live search across all columns (type to filter)">

          <table id="fileTable">
            <thead>
              <tr><th>File Name</th><th>Status</th><th>Uploaded At</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${files
                .map(
                  (f) => `
                <tr>
                  <td>${escapeHtml(String(f.filename || ""))}</td>
                  <td>${escapeHtml(String(f.status || ""))}</td>
                  <td>${escapeHtml(String(f.created_at || ""))}</td>
                  <td><a href="/extract/${encodeURIComponent(String(f.filename || ""))}">Extract</a></td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <script>
          // simple escape helper used on client-side rendering (table text is already escaped server-side)
          (function() {
            const menuBtn = document.getElementById("menuBtn");
            const sidebar = document.getElementById("sidebar");
            const content = document.getElementById("mainContent");
            menuBtn.addEventListener("click", () => {
              const isOpen = sidebar.classList.contains("active");
              sidebar.classList.toggle("active", !isOpen);
              content.classList.toggle("active", !isOpen);
            });

            // Live search on the single table
            const searchInput = document.getElementById("searchInput");
            searchInput.addEventListener("input", function() {
              const q = this.value.trim().toLowerCase();
              const rows = document.querySelectorAll("#fileTable tbody tr");
              if (!q) {
                rows.forEach(r => r.style.display = "");
                return;
              }
              rows.forEach(r => {
                const text = r.innerText.toLowerCase();
                r.style.display = text.includes(q) ? "" : "none";
              });
            });
          })();
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
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// ---- helper (server-side) ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
