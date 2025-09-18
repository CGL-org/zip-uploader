// index.js
import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";

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

// ✅ Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Session for login
app.use(
  session({
    secret: "supersecretkey", // change in production
    resave: false,
    saveUninitialized: true,
  })
);

// 📂 Multer config (upload to memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB max
});

// 🔄 Function to get file list
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

// ✅ Middleware to protect pages
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// ✅ Login page
app.get("/login", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Login</title>
      <style>
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #003c2f, #0a5f47);
          font-family: Arial, sans-serif;
        }
        .login-box {
          width: 320px;
          padding: 30px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          color: #fff;
          text-align: center;
        }
        h2 { margin-bottom: 20px; }
        input {
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border: none;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          font-size: 1em;
          outline: none;
          backdrop-filter: blur(5px);
        }
        input::placeholder { color: #ddd; }
        button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: #00b894;
          color: #fff;
          font-size: 1em;
          cursor: pointer;
          transition: background 0.3s;
        }
        button:hover { background: #019874; }
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

// ✅ Handle login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Demo credentials
  if (username === "admin" && password === "1234") {
    req.session.user = { username };
    return res.redirect("/");
  }

  res.send("<h3>❌ Invalid credentials. <a href='/login'>Try again</a></h3>");
});

// ✅ Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ✅ Home (protected) with sliding sidebar
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    res.send(`
      <html>
      <head>
        <title>Home Page</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin:0; font-family: Arial, sans-serif; background: #f4f4f4; }

          /* Sidebar */
          .sidebar {
            position: fixed;
            top: 0;
            left: -220px;
            width: 220px;
            height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(10px);
            color: #fff;
            padding-top: 60px;
            transition: left 0.3s ease;
            z-index: 1000;
          }
          .sidebar.active { left: 0; }
          .sidebar a {
            display: block;
            padding: 15px 20px;
            color: #fff;
            text-decoration: none;
            font-size: 1em;
            transition: background 0.3s;
          }
          .sidebar a:hover { background: rgba(255,255,255,0.1); }

          /* Toggle Button */
          .toggle-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #009688;
            border: none;
            color: #fff;
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 6px;
            z-index: 1100;
            transition: background 0.3s;
          }
          .toggle-btn:hover { background: #00796b; }

          /* Content */
          .content { margin-left: 20px; padding: 50px; transition: margin-left 0.3s; }
          .content.shifted { margin-left: 240px; }

          h1 { color: #333; font-size: 1.5em; }
          .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          table { width: 100%; border-collapse: collapse; min-width: 600px; }
          th, td { padding: 10px; border: 1px solid #ccc; text-align: left; font-size: 0.9em; }
          th { background: #eee; font-weight: bold; }
        </style>
      </head>
      <body>
        <button class="toggle-btn" onclick="toggleSidebar()">☰ Menu</button>

        <div class="sidebar" id="sidebar">
          <a href="#">Welcome</a>
          <a href="#">Admin</a>
          <a href="/create">Create Account</a>
          <a href="/update">Update Account</a>
          <a href="/delete">Delete Account</a>
          <a href="/logout">Logout</a>
        </div>

        <div class="content" id="mainContent">
          <h1>✅ Welcome, ${req.session.user.username}</h1>
          <h2>📂 Files in Bucket: ${BUCKET}</h2>
          <div class="table-wrapper">
            <table>
              <tr><th>Name</th><th>Type</th><th>Size</th><th>Last Modified</th><th>Link</th></tr>
              ${files.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td>${f.metadata?.mimetype || "N/A"}</td>
                  <td>${f.metadata?.size || "?"} bytes</td>
                  <td>${f.updated_at || "N/A"}</td>
                  <td><a href="${f.publicUrl}" target="_blank">Open</a></td>
                </tr>`).join('')}
            </table>
          </div>
        </div>

        <script>
          function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const content = document.getElementById('mainContent');
            sidebar.classList.toggle('active');
            content.classList.toggle('shifted');
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload ZIP only (no extraction)
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

// ✅ List files JSON
app.get("/files", requireLogin, async (req, res) => {
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
