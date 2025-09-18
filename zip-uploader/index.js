// index.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";

dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "Receive_Files";

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
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg,#003c2f,#0a5f47);
      }
      .login-box {
        width: 350px;
        padding: 30px;
        border-radius: 15px;
        background: rgba(255,255,255,0.15);
        backdrop-filter: blur(15px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        color: #fff;
        text-align:center;
      }
      h2 { margin-bottom: 20px; }
      input {
        width:100%;
        padding:12px;
        margin:10px 0;
        border:none;
        border-radius:8px;
        background: rgba(255,255,255,0.2);
        color:#fff;
        font-size:1em;
        outline:none;
      }
      input::placeholder { color:#ddd; }
      button {
        width:100%;
        padding:12px;
        border:none;
        border-radius:8px;
        background:#00b894;
        color:#fff;
        font-size:1em;
        cursor:pointer;
        transition:0.3s;
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

// Home Page
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.send(`
    <html>
    <head>
      <title>Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { margin:0; font-family: "Segoe UI", Tahoma, sans-serif; background: #f4f6f9; color:#333; }

        /* Floating Menu Button */
        #menuBtn {
          position: fixed;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          z-index: 1500;
          background: rgba(0,0,0,0.7);
          color: white;
          border: none;
          padding: 12px 8px;
          border-radius: 0 6px 6px 0;
          cursor: pointer;
          font-size: 20px;
          transition: background 0.2s;
        }
        #menuBtn:hover { background: rgba(0,0,0,0.9);}
        #menuBtn.hidden { display: none; }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: -260px;
          width: 240px;
          height: 100vh;
          background: #222;
          color: #fff;
          padding-top: 60px;
          transition: left 0.3s ease;
          z-index: 1400;
          box-shadow: 6px 0 20px rgba(0,0,0,0.2);
        }
        .sidebar.active { left: 0; }
        .sidebar a {
          display:block;
          padding:14px 20px;
          color:#fff;
          text-decoration:none;
          font-size:1rem;
        }
        .sidebar a:hover { background: rgba(255,255,255,0.08); }

        /* Header */
        .header {
          background: #009688;
          color: #fff;
          padding: 15px 25px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .header h1 {
          margin:0;
          font-size: 1.4rem;
          font-weight: 500;
        }

        /* Content */
        .content {
          padding: 30px;
        }
        .card {
          background:#fff;
          border-radius:10px;
          box-shadow:0 4px 10px rgba(0,0,0,0.08);
          padding:20px;
          margin-bottom:20px;
        }
        .card h2 {
          margin-top:0;
          font-size:1.2rem;
          color:#009688;
        }

        /* Table */
        .table-wrapper {
          overflow-x:auto;
          border-radius:10px;
        }
        table {
          width:100%;
          border-collapse:collapse;
          font-size:0.95em;
        }
        thead {
          background:#009688;
          color:#fff;
        }
        th, td {
          padding:12px 15px;
          border-bottom:1px solid #ddd;
          text-align:left;
        }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        tbody tr:hover { background:#f1f7f7; }
        a { color:#009688; text-decoration:none; font-weight:500; }
        a:hover { text-decoration:underline; }

        @media(max-width:768px){
          .content { padding:15px; }
          table { font-size:0.85em; }
        }
      </style>
    </head>
    <body>
      <!-- Floating Arrow Button -->
      <button id="menuBtn" aria-controls="sidebar" aria-expanded="false">⮞</button>

      <div class="sidebar" id="sidebar">
        <a href="/create">Create Account</a>
        <a href="/update">Update Account</a>
        <a href="/delete">Delete Account</a>
        <a href="/logout">Logout</a>
      </div>

      <div class="header">
        <h1>Admin Dashboard</h1>
      </div>

      <div class="content" id="mainContent">
        <div class="card">
          <h2>Welcome, ${req.session.user.username}</h2>
          <p>📂 Bucket: <strong>${BUCKET}</strong></p>
        </div>

        <div class="card">
          <h2>Stored Files</h2>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Type</th><th>Size</th><th>Last Modified</th><th>Link</th>
                </tr>
              </thead>
              <tbody>
              ${files.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td>${f.metadata?.mimetype || "N/A"}</td>
                  <td>${f.metadata?.size || "?"} bytes</td>
                  <td>${f.updated_at || "N/A"}</td>
                  <td>${f.publicUrl ? `<a href="${f.publicUrl}" target="_blank">Open</a>` : "-"}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        (function(){
          const menuBtn = document.getElementById('menuBtn');
          const sidebar = document.getElementById('sidebar');

          function closeSidebar(){
            sidebar.classList.remove('active');
            menuBtn.setAttribute('aria-expanded', 'false');
            menuBtn.classList.remove("hidden");
          }

          menuBtn.addEventListener('click', function(e){
            e.stopPropagation();
            sidebar.classList.toggle('active');
            const expanded = sidebar.classList.contains('active');
            menuBtn.setAttribute('aria-expanded', expanded.toString());

            if (expanded) {
              menuBtn.classList.add("hidden");
            } else {
              menuBtn.classList.remove("hidden");
            }
          });

          document.addEventListener('click', function(e){
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
              closeSidebar();
            }
          });

          document.addEventListener('keydown', function(e){
            if (e.key === 'Escape') closeSidebar();
          });
        })();
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload ZIP only
app.post("/upload-zip", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file attached (field name = file)" });
  try {
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;
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

// List files JSON
app.get("/files", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(\`u2705 Server listening on port \${PORT}\`)
);
