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
import doneRouter from "./routes/done.js";
import accountRoutes from "./routes/account.js";
import bcrypt from "bcryptjs";
import printRoutes from "./routes/print.js";
import { logAction } from "./utils/logger.js";
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

// ✅ Session must come before routes
app.use(
  session({
    secret: "supersecretkey", // better: process.env.SESSION_SECRET
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware for auth
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ✅ Routes (after session)
app.use("/print", requireLogin, printRoutes);


// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// File list (storage bucket)
async function getFileList() {
  const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  return data.map((f) => {
    const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
    return { ...f, publicUrl: g?.data?.publicUrl || null };
  });
}



// ---------- LOGIN PAGE ----------
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
        background:rgba(255,255,255,0.15); padding:30px; border-radius:15px;
        backdrop-filter:blur(10px); box-shadow:0 4px 20px rgba(0,0,0,0.3);
        width:320px; text-align:center; color:#fff;
      }
      input {
        width:90%; padding:12px; margin:10px 0; border:none;
        border-radius:8px; background:rgba(255,255,255,0.2); color:#fff;
        font-size:1em; outline:none;
      }
      input::placeholder { color:#eee; }
      button {
        width:100%; padding:12px; background:#004d40; color:#fff;
        border:none; border-radius:8px; font-size:1em; cursor:pointer;
        transition:0.3s;
      }
      button:hover { background:#00332c; }
    </style>
  </head>
  <body>
    <div class="login-box">
      <h2>🔐 Login</h2>
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

// ---------- LOGIN HANDLER ----------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, full_name, password_hash, user_type, profile_photo")
      .eq("username", username)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return res.send("<h3>❌ Invalid username. <a href='/login'>Try again</a></h3>");
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.send("<h3>❌ Invalid password. <a href='/login'>Try again</a></h3>");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.user_type ? user.user_type : "user",
      profile_photo: user.profile_photo || null
    };
await logAction(req, "login");
    

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// Logout
app.get("/logout", async (req, res) => {
  await logAction(req, "logout"); 
  req.session.destroy(() => res.redirect("/login"));
});


// ---------- DASHBOARD ----------
app.get("/", requireLogin, async (req, res) => {
  try {
    // get files from storage bucket (existing behavior)
    const files = await getFileList();
    const isAdmin = req.session.user.role === "admin";

    // --- New: counts from DB.storefile by status ---
    // NOTE: counts use exact table name 'storefile' and status values as you provided.
async function countBucket(bucket) {
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  if (error) {
    console.warn(`count ${bucket} err`, error.message);
    return 0;
  }
  return data ? data.length : 0;
}

const receiveCount   = await countBucket("Receive_Files");
const extractedCount = await countBucket("Extracted_Files");
const completedCount = await countBucket("Completed");

let usersCount = 0;
if (isAdmin) {
  try {
    const ru = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    usersCount = ru?.count || 0;
  } catch (e) { console.warn("count users err", e.message); }
}

    try {
      const r2 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Extracted_Files");
      extractedCount = r2?.count || 0;
    } catch (e) { console.warn("count extracted_files err", e.message); }

    try {
      const r3 = await supabase
        .from("storefile")
        .select("*", { count: "exact", head: true })
        .eq("status", "Completed");
      completedCount = r3?.count || 0;
    } catch (e) { console.warn("count completed err", e.message); }

    if (isAdmin) {
      try {
        const ru = await supabase
          .from("users")
          .select("*", { count: "exact", head: true });
        usersCount = ru?.count || 0;
      } catch (e) { console.warn("count users err", e.message); }
    }

    // --- New: fetch storefile rows for searchable table ---
    let storefileRows = [];
    try {
      const { data: sfdata, error: sferr } = await supabase
        .from("storefile")
        .select("*")
        .order("created_at", { ascending: false });
      if (sferr) throw sferr;
      storefileRows = sfdata || [];
    } catch (e) {
      console.warn("fetch storefile rows err", e.message);
      storefileRows = [];
    }

    // safe fallback for profile (use a small placeholder if missing)
    const profileSrc = req.session.user.profile_photo
      ? req.session.user.profile_photo
      : "https://via.placeholder.com/150?text=Profile";

    const sidebarLinks = `
      <a href="/">🏠 Dashboard</a>
      <a href="/extracted">📂 Extracted Files</a>
      <a href="/done">✅ Check and Completed</a>
      <a href="/print">🖨 Print Reports</a>
      ${isAdmin ? `<a href="/account">👥 Accounts</a>` : ""}
      <li><a href="/logpage">📜 Operation Logs</a></li>
      <a href="/logout">🚪 Logout</a>
    `;

    // Build storefile table header based on keys (if rows exist)
    const storefileHead = storefileRows.length > 0 ? Object.keys(storefileRows[0]) : [];
    // Render page
    res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Dashboard</title>
      <style>
        :root { --sidebar-w: 240px; --brand:#004d40; --accent:#009688; --bg:#f4f6f9; }
        * { box-sizing: border-box; }
        body { margin:0; font-family: 'Segoe UI', Roboto, Arial, sans-serif; background:var(--bg); color:#222; }
        header { background:var(--brand); color:white; padding:15px; text-align:center; font-size:1.25rem; position:fixed; left:0; right:0; top:0; z-index:900; }
        main { padding: 100px 24px 24px 24px; transition: margin-left .3s ease; }

        /* Sidebar */
        .sidebar {
          position:fixed;
          top:0;
          left: calc(-1 * var(--sidebar-w)); /* hide sidebar initially */
          width:var(--sidebar-w);
          height:100vh;
          background:var(--brand);
          color:white;
          padding-top:72px;
          transition: left .28s ease;
          box-shadow:2px 0 6px rgba(0,0,0,0.2);
          z-index:1000;
          overflow-y:auto;
        }

        .sidebar.active { left: 0; }

        .sidebar .profile {
          text-align:center;
          padding:20px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
        }

        .sidebar .profile img {
          width: 96px; height: 96px; border-radius: 50%; object-fit: cover;
          border: 3px solid rgba(255,255,255,0.18);
          display:block; margin:0 auto 10px;
        }

        .sidebar .profile h3 { margin:6px 0 2px; font-size: 1rem; color:#fff; font-weight:600; }
        .sidebar .profile p { margin:0; color:rgba(255,255,255,0.8); font-size:0.85rem; }

        .sidebar .menu { padding:16px 8px; }
        .sidebar .menu a {
          display:flex; align-items:center; gap:10px; padding:10px 14px; color: #fff;
          text-decoration:none; border-radius:8px; margin:8px 8px; transition: background .15s ease, transform .08s ease; font-weight:500;
        }
        .sidebar .menu a:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }

        /* Menu button */
        #menuBtn {
          position: fixed;
          top:18px;
          left:18px;
          z-index:1100;
          background: #00796b;
          color:white;
          border:none;
          padding:8px 12px;
          border-radius:6px;
          cursor:pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }

        /* Content (table area) */
        .content { transition: margin-left .28s ease; margin-left: 0; }
        .content.shifted { margin-left: var(--sidebar-w); }

        .panel { background: #fff; padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); margin-bottom:18px; }

        /* Info boxes */
        .info-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:16px; margin-bottom:18px; align-items:stretch; }
        .info-card {
          padding:18px; border-radius:12px; color:#fff; display:flex; flex-direction:column; justify-content:center; align-items:flex-start;
          box-shadow:0 6px 18px rgba(0,0,0,0.06); min-height:86px;
        }
        .info-card .label { font-size:0.9rem; opacity:0.9; }
        .info-card .value { font-size:1.8rem; font-weight:700; margin-top:6px; }
        .info-received { background: linear-gradient(135deg,#00695c,#009688); }
        .info-extracted { background: linear-gradient(135deg,#1e88e5,#42a5f5); }
        .info-completed { background: linear-gradient(135deg,#f9a825,#ffca28); color: rgba(0,0,0,0.85); }
        .info-users { background: linear-gradient(135deg,#8e24aa,#d81b60); }

        /* Table styling */
        table { width:100%; border-collapse:collapse; margin-top: 12px; }
        thead { background: var(--accent); color: #fff; border-radius:6px; }
        th, td { padding:10px; text-align:center; border-bottom:1px solid #eee; word-break:break-word; }
        tbody tr:nth-child(even) { background:#fafafa; }

        .search { width:100%; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:10px; }

        @media (max-width:720px) {
          :root { --sidebar-w: 200px; }
          .sidebar .profile img { width:72px; height:72px; }
          #menuBtn { left:12px; top:12px; }
        }
      </style>
    </head>
    <body>
      <header>🏠 Bottle Scanner Admin Portal</header>

      <button id="menuBtn" aria-label="Toggle menu">☰ Menu</button>

      <aside id="sidebar" class="sidebar" aria-label="Sidebar navigation">
        <div class="profile" role="region" aria-label="User profile">
          <img
            src="${profileSrc}"
            alt="Profile"
            width="96"
            height="96"
            style="display:block; width:96px; height:96px; object-fit:cover; border-radius:50%;"
          />
          <h3>${req.session.user.full_name || "User"}</h3>
          <p>${req.session.user.role || "user"}</p>
        </div>

        <nav class="menu" role="navigation" aria-label="Main menu">
          ${sidebarLinks}
        </nav>
      </aside>

      <main class="content" id="mainContent">
        <div class="panel">
          <h2>📂 File Management (Dashboard)</h2>

          <!-- Info boxes -->
          <div class="info-grid" aria-hidden="false">
            <div class="info-card info-received" title="Received Files">
              <div class="label">📥 Received Files</div>
              <div class="value">${receiveCount ?? 0}</div>
            </div>

            <div class="info-card info-extracted" title="Extracted Files">
              <div class="label">📂 Extracted Files</div>
              <div class="value">${extractedCount ?? 0}</div>
            </div>

            <div class="info-card info-completed" title="Completed">
              <div class="label">✅ Completed</div>
              <div class="value">${completedCount ?? 0}</div>
            </div>

            ${isAdmin ? `
              <div class="info-card info-users" title="Users (admins only)">
                <div class="label">👥 Users</div>
                <div class="value">${usersCount ?? 0}</div>
              </div>` : ''}
          </div>

          <!-- existing Stored Files table (keeps original behavior) -->
          <h3>📦 Received Files</h3>
          <input id="storefileSearch" class="search" type="search" placeholder="🔎 type to filter">
          <table id="storefileTable">
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

        <!-- New searchable storefile DB table -->
        <div class="panel">



         
      
<tbody>
  ${storefileRows.length > 0
    ? storefileRows.map(r => {
        const cells = Object.values(r).map(v => {
          let val = "";
          if (v === null || v === undefined) val = "";
          else if (typeof v === "object") {
            try { val = JSON.stringify(v); } catch (e) { val = String(v); }
          } else val = String(v);
          val = val.replace && val.replace(/</g, "&lt;");
          return `<td>${val}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("")
    : ""}
</tbody>
            </table>
          </div>
        </div>

      </main>

      <script>
        (function() {
          const menuBtn = document.getElementById("menuBtn");
          const sidebar = document.getElementById("sidebar");
          const mainContent = document.querySelector(".content");

          menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active");
            mainContent.classList.toggle("shifted");
          });

          // Close sidebar when clicking outside on small screens
          document.addEventListener("click", (e) => {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains("active")) {
              sidebar.classList.remove("active");
              mainContent.classList.remove("shifted");
            }
          });

          // Live search for storefile table
          const searchInput = document.getElementById('storefileSearch');
          if (searchInput) {
            searchInput.addEventListener('input', function() {
              const filter = this.value.toLowerCase();
              const rows = document.querySelectorAll('#storefileTable tbody tr');
              rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? "" : "none";
              });
            });
          }
        })();
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    console.error(err);
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
      await supabase.storage.from(EXTRACTED_BUCKET).upload(filePath, content, { upsert: true });
    }

    await supabase.storage.from(BUCKET).remove([fileName]);

function formatDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

    
    const metaFilePath = `${zipBase}/.extracted.json`;
    await supabase.storage.from(EXTRACTED_BUCKET).upload(
      metaFilePath,
      Buffer.from(JSON.stringify({ extractedAt: formatDateTime() })),
      { upsert: true, contentType: "application/json" }
    );

    res.redirect("/extracted");
  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).send("Error extracting: " + err.message);
  }
});

// Upload ZIP
app.post("/upload-zip", upload.single("file"), async (req, res) => {
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

// Mount routes
app.use("/extracted", requireLogin, extractedRoutes);
app.use("/done", requireLogin, doneRouter);
app.use("/account", requireLogin, accountRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
