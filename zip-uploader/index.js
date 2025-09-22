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

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ---------- DASHBOARD ----------
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    const isAdmin = req.session.user.role === "admin";
    const sidebarLinks = `
      <a href="/">🏠 Dashboard</a>
      <a href="/extracted">📂 Extracted Files</a>
      <a href="/done">✅ Check and Completed</a>
      ${isAdmin ? `<a href="/account">👥 Accounts</a>` : ""}
      <a href="/logout">🚪 Logout</a>
    `;

    // safe fallback for profile (use a small placeholder if missing)
    const profileSrc = req.session.user.profile_photo
      ? req.session.user.profile_photo
      : "https://via.placeholder.com/150?text=Profile";

    res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Dashboard</title>
      <style>
        :root { --sidebar-w: 240px; --brand:#004d40; --accent:#009688; }
        * { box-sizing: border-box; }

        body { margin:0; font-family: 'Segoe UI', Roboto, Arial, sans-serif; background:#f4f6f9; color:#222; }
        header { background:var(--brand); color:white; padding:15px; text-align:center; font-size:1.25rem; position:fixed; left:0; right:0; top:0; z-index:900; }
        main { padding: 80px 24px 24px 24px; transition: margin-left .3s ease; }

        /* Sidebar */
        .sidebar {
          position:fixed;
          top:0;
          left:-1 * var(--sidebar-w); /* hidden by default; toggled with .active */
          width:var(--sidebar-w);
          height:100vh;
          background:var(--brand);
          color:white;
          padding-top:72px; /* space for header */
          transition: left .28s ease;
          box-shadow:2px 0 6px rgba(0,0,0,0.2);
          z-index:1000;
          overflow-y:auto;
        }
        .sidebar.active { left: 0; }

        /* Profile block */
        .sidebar .profile {
          text-align:center;
          padding:20px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
        }

        /* inline width/height attributes on the <img> ensure the browser reserves space immediately */
        .sidebar .profile img {
          width: 96px;      /* fixed visual size */
          height: 96px;
          max-width: 96px;
          max-height: 96px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.18);
          display:block;
          margin:0 auto 10px;
          background: #fff; /* placeholder bg while image loads */
        }

        .sidebar .profile h3 {
          margin:6px 0 2px;
          font-size: 1rem;
          color:#fff;
          line-height:1.1;
          font-weight:600;
        }
        .sidebar .profile p {
          margin:0;
          color:rgba(255,255,255,0.8);
          font-size:0.85rem;
        }

        /* Menu area */
        .sidebar .menu {
          padding:16px 8px;
        }
        .sidebar .menu a {
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          color: #fff;
          text-decoration:none;
          border-radius:8px;
          margin:8px 8px;
          transition: background .15s ease, transform .08s ease;
          font-weight:500;
        }
        .sidebar .menu a:hover {
          background: rgba(255,255,255,0.05);
          transform: translateX(4px);
        }

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
        .content {
          transition: margin-left .28s ease;
          margin-left: 0;
        }
        .content.shifted { margin-left: var(--sidebar-w); }

        /* Table styling */
        .panel {
          background: #fff;
          padding: 18px;
          border-radius: 10px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }
        table { width:100%; border-collapse:collapse; margin-top: 12px; }
        thead { background: var(--accent); color: #fff; border-radius:6px; }
        th, td { padding:12px; text-align:center; border-bottom:1px solid #eee; }

        /* small screens */
        @media (max-width:720px) {
          :root { --sidebar-w: 200px; }
          .sidebar .profile img { width:72px; height:72px; max-width:72px; max-height:72px; }
          #menuBtn { left:12px; top:12px; }
        }
      </style>
    </head>
    <body>
      <header>🏠 Dashboard (${req.session.user.role})</header>

      <button id="menuBtn" aria-label="Toggle menu">☰ Menu</button>

      <aside id="sidebar" class="sidebar" aria-label="Sidebar navigation">
        <div class="profile" role="region" aria-label="User profile">
          <!-- inline size attributes + style ensure immediate layout, CSS refines styling -->
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
          <h2>📦 Stored Files</h2>
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
app.listen(PORT, () => console.log(\`✅ Server listening on port \${PORT}\`));
