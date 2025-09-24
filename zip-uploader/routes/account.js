// routes/account.js
// Express router for user account CRUD with profile photo upload
// Uses Supabase (service role key) for DB and storage.

import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_BUCKET = process.env.SUPABASE_USER_BUCKET || "profile_photos";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to get public URL for a stored file path
function publicUrlFor(path) {
  try {
    const g = supabase.storage.from(USER_BUCKET).getPublicUrl(path);
    return g?.data?.publicUrl || null;
  } catch (err) {
    return null;
  }
}

// ================== LIST USERS ==================
router.get("/", async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accounts</title>
<style>
:root { --sidebar-w: 240px; --brand:#004d40; --accent:#009688; --bg:#f4f6f9; }
body { margin:0; font-family:'Segoe UI', Roboto, Arial, sans-serif; background:var(--bg); color:#222; }
header { background:var(--brand); color:white; padding:15px; text-align:center; font-size:1.25rem; position:fixed; left:0; right:0; top:0; z-index:900; }
#menuBtn { position: fixed; top:18px; left:18px; z-index:1100; background: #00796b; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.15); }
.sidebar { position:fixed; top:0; left: calc(-1 * var(--sidebar-w)); width:var(--sidebar-w); height:100vh; background:var(--brand); color:white; padding-top:72px; transition:left .28s ease; box-shadow:2px 0 6px rgba(0,0,0,0.2); z-index:1000; overflow-y:auto; }
.sidebar.active { left:0; }
.sidebar .profile { text-align:center; padding:20px 14px; border-bottom:1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent); }
.sidebar .profile img { width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid rgba(255,255,255,0.18); display:block; margin:0 auto 10px; }
.sidebar .profile h3 { margin:6px 0 2px; font-size:1rem; color:#fff; font-weight:600; }
.sidebar .profile p { margin:0; color:rgba(255,255,255,0.8); font-size:0.85rem; }
.sidebar .menu { padding:16px 8px; }
.sidebar .menu a { display:flex; align-items:center; gap:10px; padding:10px 14px; color:#fff; text-decoration:none; border-radius:8px; margin:8px 8px; transition: background .15s ease, transform .08s ease; font-weight:500; }
.sidebar .menu a:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }
.content { transition: margin-left .28s ease; margin-left:0; padding:20px; }
.content.shifted { margin-left: var(--sidebar-w); }
table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:80px; }
thead { background:var(--accent); color:white; }
th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
tbody tr:nth-child(even) { background:#f9f9f9; }
button { background:var(--accent); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; }
button:hover { background:#00796b; }
input { width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc; font-size:1em; }
img.avatar { width:48px; height:48px; border-radius:8px; object-fit:cover; border:1px solid #ddd; }
.actions a, .actions button { margin:0 4px; padding:6px 10px; border-radius:6px; border:none; cursor:pointer; text-decoration:none; }
.actions .btn-edit { background:#0288d1; color:white; }
.actions .btn-delete { background:#e53935; color:white; }
</style>
</head>
<body>
<header>👥 Accounts</header>
<button id="menuBtn">☰ Menu</button>

<aside id="sidebar" class="sidebar">
  <div class="profile">
    <img src="${req.session.user?.profile_photo || 'https://via.placeholder.com/150?text=Profile'}" alt="Profile">
    <h3>${req.session.user?.full_name || 'User'}</h3>
    <p>${req.session.user?.role || 'user'}</p>
  </div>
  <nav class="menu">
    <a href="/">🏠 Dashboard</a>
    <a href="/extracted">📂 Extracted Files</a>
    <a href="/done">✅ Check and Complete</a>
    <a href="/account">👥 Accounts</a>
    <a href="/logout">🚪 Logout</a>
  </nav>
</aside>

<div class="content" id="mainContent">
  <h2>All users</h2>
  <input type="text" id="searchInput" placeholder="🔍 Type to filter">
  <a href="/account/create" style="display:inline-block; margin-bottom:10px; background:#00796b; color:white; padding:8px 12px; border-radius:6px;">➕ Create account</a>
  <table>
    <thead>
      <tr>
        <th>Photo</th><th>Full name</th><th>Username</th><th>Email</th><th>Contact</th><th>Gender</th><th>User Type</th><th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${users.map(u => {
        const photo = u.profile_photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='100%' height='100%' fill='%23ddd'/></svg>";
        return `<tr>
          <td data-label="Photo"><img class="avatar" src="${photo}"></td>
          <td data-label="Full name">${u.full_name || "-"}</td>
          <td data-label="Username">${u.username || "-"}</td>
          <td data-label="Email">${u.email || "-"}</td>
          <td data-label="Contact">${u.contact_number || "-"}</td>
          <td data-label="Gender">${u.gender || "-"}</td>
          <td data-label="User Type">${u.user_type || "user"}</td>
          <td class="actions">
            <a class="btn-edit" href="/account/edit/${u.id}">Edit</a>
            <form style="display:inline" method="POST" action="/account/delete/${u.id}" onsubmit="return confirm('Delete user?')">
              <button class="btn-delete" type="submit">Delete</button>
            </form>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>

<script>
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const content = document.getElementById("mainContent");
menuBtn.addEventListener("click", () => { sidebar.classList.toggle("active"); content.classList.toggle("shifted"); });
document.addEventListener("click", e => {
  if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    content.classList.remove("shifted");
  }
});

// Search bar filter
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const filter = searchInput.value.toLowerCase();
  document.querySelectorAll("table tbody tr").forEach(row => {
    const name = row.querySelector("td[data-label='Full name']").innerText.toLowerCase();
    row.style.display = name.includes(filter) ? "" : "none";
  });
});
</script>
</body>
</html>
    `);
  } catch(err) { res.status(500).send("Error fetching users: "+err.message); }
});


// ================== CREATE FORM ==================
router.get("/create", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Create Account</title>
      <style>
        body { margin:0; font-family: 'Segoe UI', sans-serif; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
        .sidebar { position:fixed; top:0; left:-240px; width:220px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; box-shadow:2px 0 6px rgba(0,0,0,0.2); z-index:1000; }
        .sidebar.active { left:0; }
        .sidebar a { display:block; padding:14px 18px; color:white; text-decoration:none; font-weight:500; }
        .sidebar a:hover { background:#00796b; padding-left:25px; }
        #menuBtn { position:fixed; top:15px; left:15px; background:#00796b; color:white; border:none; padding:10px 14px; cursor:pointer; border-radius:6px; font-size:1em; z-index:2000; }
        .content { padding:20px; margin-left:0; transition:margin-left 0.3s; }
        .content.shifted { margin-left:220px; }
        .container { max-width:720px; margin:30px auto; background:white; padding:20px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1);} 
        input, select { width:100%; padding:10px; margin:8px 0; border-radius:6px; border:1px solid #ddd; }
        label { font-weight:600; }
        button { background:#00796b; color:white; padding:10px 14px; border-radius:8px; border:none; cursor:pointer; }
      </style>
    </head>
    <body>
      <header>Create account</header>
      <button id="menuBtn">☰ Menu</button>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="/done">✅ Check and Completed</a>
        <a href="/account">👥 Accounts</a>
        <a href="/logout">🚪 Logout</a>
      </div>
      <div class="content" id="mainContent">
        <div class="container">
          <form method="POST" action="/account/create" enctype="multipart/form-data">
            <label>Profile photo</label>
            <input type="file" name="profile" accept="image/*" />

            <label>Full name</label>
            <input name="full_name" required />

            <label>Username</label>
            <input name="username" required />

            <label>Password</label>
            <input name="password" type="password" required />

            <label>Address</label>
            <input name="address" />

            <label>Email address</label>
            <input name="email" type="email" />

            <label>Contact number</label>
            <input name="contact_number" />

            <label>Gender</label>
            <select name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>

            <label>User Type</label>
            <select name="user_type"><option value="user" selected>User</option><option value="admin">Admin</option></select>

            <div style="margin-top:12px; display:flex; gap:8px;">
              <button type="submit">Create</button>
              <a href="/account" style="align-self:center; margin-left:8px;">Cancel</a>
            </div>
          </form>
        </div>
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
});

// ================== HANDLE CREATE ==================
router.post("/create", upload.single("profile"), async (req, res) => {
  try {
    const {
      full_name,
      username,
      password,
      address,
      email,
      contact_number,
      gender,
      user_type,
    } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).send("Missing required fields");
    }

    const hashed = bcrypt.hashSync(password, 10);
    let profile_photo = null;

    if (req.file) {
      const filename = `profiles/${username}_${Date.now()}_${req.file.originalname}`;
      const { error: uploadErr } = await supabase.storage
        .from(USER_BUCKET)
        .upload(filename, req.file.buffer, {
          upsert: true,
          contentType: req.file.mimetype,
        });
      if (uploadErr) throw uploadErr;
      profile_photo = publicUrlFor(filename);
    }

    const { error } = await supabase.from("users").insert([
      {
        full_name,
        username,
        password_hash: hashed,
        address,
        email,
        contact_number,
        gender,
        profile_photo,
        user_type: user_type || "user",
      },
    ]);

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).send("Failed to create account: " + error.message);
    }

    res.redirect("/account");
  } catch (err) {
    console.error("Create error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// ================== EDIT FORM ==================
router.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data: u, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error) throw error;

    res.send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Edit user</title>
        <style>
          body { margin:0; font-family: 'Segoe UI', sans-serif; background:#f4f6f9; }
          header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
          .sidebar { position:fixed; top:0; left:-240px; width:220px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; box-shadow:2px 0 6px rgba(0,0,0,0.2); z-index:1000; }
          .sidebar.active { left:0; }
          .sidebar a { display:block; padding:14px 18px; color:white; text-decoration:none; font-weight:500; }
          .sidebar a:hover { background:#00796b; padding-left:25px; }
          #menuBtn { position:fixed; top:15px; left:15px; background:#00796b; color:white; border:none; padding:10px 14px; cursor:pointer; border-radius:6px; font-size:1em; z-index:2000; }
          .content { padding:20px; margin-left:0; transition:margin-left 0.3s; }
          .content.shifted { margin-left:220px; }
          .container { max-width:720px; margin:30px auto; background:white; padding:20px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1);} 
          input, select { width:100%; padding:10px; margin:8px 0; border-radius:6px; border:1px solid #ddd; }
          label { font-weight:600; }
          button { background:#0288d1; color:white; padding:10px 14px; border-radius:8px; border:none; cursor:pointer; }
          img.avatar { width:72px; height:72px; border-radius:8px; object-fit:cover; border:1px solid #ddd; }
        </style>
      </head>
      <body>
        <header>Edit user</header>
        <button id="menuBtn">☰ Menu</button>
        <div id="sidebar" class="sidebar">
          <a href="/">🏠 Dashboard</a>
          <a href="/extracted">📂 Extracted Files</a>
          <a href="/done">✅ Check and Completed</a>
          <a href="/account">👥 Accounts</a>
          <a href="/logout">🚪 Logout</a>
        </div>
        <div class="content" id="mainContent">
          <div class="container">
            <form method="POST" action="/account/edit/${u.id}" enctype="multipart/form-data">
              <label>Profile photo</label>
              <div style="display:flex; gap:12px; align-items:center;">
                <img class="avatar" src="${u.profile_photo || ''}" />
                <input type="file" name="profile" accept="image/*" />
              </div>

              <label>Full name</label>
              <input name="full_name" value="${u.full_name || ''}" required />

              <label>Username</label>
              <input name="username" value="${u.username || ''}" required />

              <label>Password (leave blank to keep current)</label>
              <input name="password" type="password" />

              <label>Address</label>
              <input name="address" value="${u.address || ''}" />

              <label>Email address</label>
              <input name="email" type="email" value="${u.email || ''}" />

              <label>Contact number</label>
              <input name="contact_number" value="${u.contact_number || ''}" />

              <label>Gender</label>
              <select name="gender">
                <option value="">Select</option>
                <option ${u.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option ${u.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option ${u.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>

              <label>User Type</label>
              <select name="user_type">
                <option value="user" ${u.user_type === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${u.user_type === 'admin' ? 'selected' : ''}>Admin</option>
              </select>

              <div style="margin-top:12px; display:flex; gap:8px;">
                <button type="submit">Save</button>
                <a href="/account" style="align-self:center; margin-left:8px;">Cancel</a>
              </div>
            </form>
          </div>
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
    console.error(err);
    res.status(500).send("Error loading user: " + err.message);
  }
});

// ================== HANDLE EDIT ==================
router.post("/edit/:id", upload.single("profile"), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      full_name,
      username,
      password,
      address,
      email,
      contact_number,
      gender,
      user_type,
    } = req.body;

    const { data: existing, error: fetchErr } = await supabase.from("users").select("*").eq("id", id).single();
    if (fetchErr) throw fetchErr;

    let profile_photo = existing.profile_photo;

    if (req.file) {
      const filename = `profiles/${username}_${Date.now()}_${req.file.originalname}`;
      const { error: uploadErr } = await supabase.storage.from(USER_BUCKET).upload(filename, req.file.buffer, {
        upsert: true,
        contentType: req.file.mimetype,
      });
      if (uploadErr) throw uploadErr;
      profile_photo = publicUrlFor(filename);
    }

    const updates = {
      full_name,
      username,
      address,
      email,
      contact_number,
      gender,
      profile_photo,
      user_type: user_type || "user",
    };

    if (password && password.trim() !== "") {
      updates.password_hash = bcrypt.hashSync(password, 10);
    }
    
    const { error } = await supabase.from("users").update(updates).eq("id", id);
    if (error) throw error;

    res.redirect("/account");
  } catch (err) {
    console.error(err);
    res.status(500).send("Update error: " + err.message);
  }
});

// ================== DELETE ==================
router.post("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;

    res.redirect("/account");
  } catch (err) {
    console.error(err);
    res.status(500).send("Delete error: " + err.message);
  }
});

export default router;
