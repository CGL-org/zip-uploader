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
        body { font-family: Arial; background: #e0f7f5; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .login-box { background: #fff; padding: 30px; border-radius: 10px; width: 300px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        h2 { text-align: center; margin-bottom: 20px; color: #00695c; }
        input { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ccc; border-radius: 6px; }
        button { width: 100%; padding: 10px; background: #009688; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer; }
        button:hover { background: #00796b; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>Login</h2>
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

// ✅ Home (protected)
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    let html = `
      <html>
      <head>
        <title>Home Page</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; margin: 0; }
          h1 { color: #333; font-size: 1.5em; }
          .menu { margin: 15px 0; }
          .menu a { display: inline-block; margin: 5px; padding: 10px 15px; background: #009688; color: #fff; border-radius: 6px; text-decoration: none; }
          .menu a:hover { background: #00796b; }
          .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          table { width: 100%; border-collapse: collapse; min-width: 600px; }
          th, td { padding: 10px; border: 1px solid #ccc; text-align: left; font-size: 0.9em; }
          th { background: #eee; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>✅ Welcome, ${req.session.user.username}</h1>
        <div class="menu">
          <a href="/create">Create Account</a>
          <a href="/update">Update Account</a>
          <a href="/delete">Delete Account</a>
          <a href="/logout">Logout</a>
        </div>
        <h2>📂 Files in Bucket: ${BUCKET}</h2>
        <div class="table-wrapper">
          <table>
            <tr><th>Name</th><th>Type</th><th>Size</th><th>Last Modified</th><th>Link</th></tr>
    `;

    files.forEach((file) => {
      html += `
        <tr>
          <td>${file.name}</td>
          <td>${file.metadata?.mimetype || "N/A"}</td>
          <td>${file.metadata?.size || "?"} bytes</td>
          <td>${file.updated_at || "N/A"}</td>
          <td><a href="${file.publicUrl}" target="_blank">Open</a></td>
        </tr>
      `;
    });

    html += `
          </table>
        </div>
      </body>
      </html>
    `;

    res.send(html);
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
