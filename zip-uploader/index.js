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

// Login page
app.get("/login", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Login</title>
    <style>

.profile {
  text-align: center;
  padding: 20px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.profile img {
  max-width: 120px;  
  max-height: 120px;
  width: 100%;
  height: auto;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #fff;
  display: block;
  margin: 0 auto 10px auto;
}

.profile h3 {
  margin: 5px 0 2px;
  font-size: 1.1em;
}
.profile p {
  margin: 0;
  font-size: 0.9em;
  color: #cfd8dc;
}
.menu {
  margin-top: 20px;
}


    
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

// Handle login
// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, full_name, password_hash, user_type, profile_photo") // ✅ fetch role
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
      profile_photo: user.profile_photo || null// ✅ respect role from DB
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

// Dashboard
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    const isAdmin = req.session.user.role === "admin";

    // sidebar links depending on role
    const sidebarLinks = `
      <a href="/extracted">📂 Extracted Files</a>
      <a href="/done">✅ Check and Completed</a>
      ${isAdmin ? `<a href="/account">👥 Accounts</a>` : ""}
      <a href="/logout">🚪 Logout</a>
    `;

    res.send(`
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { margin:0; font-family: 'Segoe UI', sans-serif; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }

        .sidebar {
          position:fixed; top:0; left:-240px; width:220px; height:100%;
          background:#004d40; color:white; padding-top:60px; transition:0.3s;
          box-shadow:2px 0 6px rgba(0,0,0,0.2);
          z-index: 1000;
        }
        .sidebar.active { left: 0; }
        .sidebar a {
          display:block; padding:14px 18px; color:white; text-decoration:none;
          font-weight:500; transition:0.2s;
        }
        .sidebar a:hover { background:#00796b; padding-left:25px; }

        #menuBtn {
          position:fixed; top:15px; left:15px; background:#00796b;
          color:white; border:none; padding:10px 14px; cursor:pointer;
          border-radius:6px; font-size:1em; z-index:2000;
        }

        .content { padding:20px; margin-left:0; transition:margin-left 0.3s; }
        .content.shifted { margin-left: 220px; }

        table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:20px; }
        thead { background:#009688; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        button { background:#009688; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }
        button:hover { background:#00796b; }
        
        @media(max-width:768px){
          table, thead, tbody, th, td, tr { display:block; width:100%; }
          thead { display:none; }
          tr { margin-bottom:15px; background:white; border-radius:6px; padding:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
          td { text-align:right; padding-left:50%; position:relative; }
          td::before { content:attr(data-label); position:absolute; left:10px; width:45%; font-weight:bold; text-align:left; }
        }
      </style>
    </head>
    <body>
      <header>🏠 Dashboard (${req.session.user.role})</header>
      <button id="menuBtn">☰ Menu</button>
       <div id="sidebar" class="sidebar">
        <div class="profile">
          <img src="${req.session.user.profile_photo || "https://via.placeholder.com/100"}" alt="Profile" />
          <h3>${req.session.user.full_name || "User"}</h3>
          <p>${req.session.user.role || "user"}</p>
        </div>
        <div class="menu">
          ${sidebarLinks}
        </div>
      </div>

      <div class="content" id="mainContent">
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

      <script>
        const menuBtn = document.getElementById("menuBtn");
        const sidebar = document.getElementById("sidebar");
        const content = document.getElementById("mainContent");
        
        menuBtn.addEventListener("click", () => {
          sidebar.classList.toggle("active");
          content.classList.toggle("shifted");
        });
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
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
