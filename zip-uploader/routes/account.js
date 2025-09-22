// routes/account.js
// Express router for simple user account CRUD with profile photo upload
// Uses Supabase (service role key) for DB and storage. Please ensure
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available in your .env

import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_BUCKET = process.env.SUPABASE_USER_BUCKET || "User_Profiles";

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

// List users (HTML)
router.get("/", async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    res.send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Accounts</title>
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
          table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:20px; }
          thead { background:#009688; color:white; }
          th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
          tbody tr:nth-child(even) { background:#f9f9f9; }
          img.avatar { width:48px; height:48px; border-radius:8px; object-fit:cover; }
          .actions button, .actions a { margin:0 4px; padding:6px 10px; border-radius:6px; border:none; cursor:pointer; }
          .btn-edit { background:#0288d1; color:white; }
          .btn-delete { background:#e53935; color:white; }
          .btn-create { background:#00796b; color:white; padding:10px 14px; border-radius:8px; }
        </style>
      </head>
      <body>
        <header>👥 Accounts</header>
        <button id="menuBtn">☰ Menu</button>
        <div id="sidebar" class="sidebar">
          <a href="/">🏠 Dashboard</a>
          <a href="/extracted">📂 Extracted Files</a>
          <a href="/done">✅ Check and Completed</a>
          <a href="/account">👥 Accounts</a>
          <a href="/logout">🚪 Logout</a>
        </div>

        <div class="content" id="mainContent">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h2>All users</h2>
            <a class="btn-create" href="/account/create">➕ Create account</a>
          </div>

          <table>
            <thead>
              <tr><th>Photo</th><th>Full name</th><th>Username</th><th>Email</th><th>Contact</th><th>Gender</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${users
                .map((u) => {
                  const photo = u.profile_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='100%' height='100%' fill='%23ddd'/></svg>";
                  return `
                    <tr>
                      <td><img class="avatar" src="${photo}" alt="avatar"/></td>
                      <td>${u.full_name || "-"}</td>
                      <td>${u.username || "-"}</td>
                      <td>${u.email || "-"}</td>
                      <td>${u.contact_number || "-"}</td>
                      <td>${u.gender || "-"}</td>
                      <td class="actions">
                        <a class="btn-edit" href="/account/edit/${u.id}">Edit</a>
                        <form style="display:inline" method="POST" action="/account/delete/${u.id}" onsubmit="return confirm('Delete user?')">
                          <button class="btn-delete" type="submit">Delete</button>
                        </form>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
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
    console.error(err);
    res.status(500).send("Error fetching users: " + err.message);
  }
});

// Create form
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
        .container { max-width:720px; margin:30px auto; background:white; padding:20px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1);} 
        input, select { width:100%; padding:10px; margin:8px 0; border-radius:6px; border:1px solid #ddd; }
        label { font-weight:600; }
        button { background:#00796b; color:white; padding:10px 14px; border-radius:8px; border:none; cursor:pointer; }
      </style>
    </head>
    <body>
      <header>Create account</header>
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

          <div style="margin-top:12px; display:flex; gap:8px;">
            <button type="submit">Create</button>
            <a href="/account" style="align-self:center; margin-left:8px;">Cancel</a>
          </div>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle create (upload profile optional)
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
    } = req.body;

    // basic validation
    if (!username || !password || !full_name) return res.status(400).send("Missing required fields");

    const hashed = bcrypt.hashSync(password, 10);
    let profile_path = null;
    let profile_url = null;

    if (req.file) {
      const filename = `profiles/${username}_${Date.now()}_${req.file.originalname}`;
      const { error: uploadErr } = await supabase.storage.from(USER_BUCKET).upload(filename, req.file.buffer, {
        upsert: true,
        contentType: req.file.mimetype,
      });
      if (uploadErr) throw uploadErr;
      profile_path = filename;
      profile_url = publicUrlFor(filename);
    }

    const { error } = await supabase.from("users").insert([
      {
        full_name,
        username,
        password: hashed,
        address,
        email,
        contact_number,
        gender,
        profile_path,
        profile_url,
      },
    ]);
    if (error) throw error;

    res.redirect("/account");
  } catch (err) {
    console.error(err);
    res.status(500).send("Create error: " + err.message);
  }
});

// Edit form
router.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error) throw error;
    const u = data;

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
          .container { max-width:720px; margin:30px auto; background:white; padding:20px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1);} 
          input, select { width:100%; padding:10px; margin:8px 0; border-radius:6px; border:1px solid #ddd; }
          label { font-weight:600; }
          button { background:#0288d1; color:white; padding:10px 14px; border-radius:8px; border:none; cursor:pointer; }
        </style>
      </head>
      <body>
        <header>Edit user</header>
        <div class="container">
          <form method="POST" action="/account/edit/${u.id}" enctype="multipart/form-data">
            <label>Profile photo</label>
            <div style="display:flex; gap:12px; align-items:center;">
              <img src="${u.profile_url || ''}" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid #ddd"/>
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
            <select name="gender"><option value="">Select</option>
              <option ${u.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option ${u.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option ${u.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>

            <div style="margin-top:12px; display:flex; gap:8px;">
              <button type="submit">Save</button>
              <a href="/account" style="align-self:center; margin-left:8px;">Cancel</a>
            </div>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading user: " + err.message);
  }
});

// Handle edit
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
    } = req.body;

    // fetch existing record to know profile_path
    const { data: existing, error: fetchErr } = await supabase.from("users").select("*").eq("id", id).single();
    if (fetchErr) throw fetchErr;

    let profile_path = existing.profile_path;
    let profile_url = existing.profile_url;

    if (req.file) {
      // if there was an old profile_path, try to delete it
      if (profile_path) {
        try { await supabase.storage.from(USER_BUCKET).remove([profile_path]); } catch(e) { /* ignore */ }
      }
      const filename = `profiles/${username}_${Date.now()}_${req.file.originalname}`;
      const { error: uploadErr } = await supabase.storage.from(USER_BUCKET).upload(filename, req.file.buffer, {
        upsert: true,
        contentType: req.file.mimetype,
      });
      if (uploadErr) throw uploadErr;
      profile_path = filename;
      profile_url = publicUrlFor(filename);
    }

    const updates = {
      full_name,
      username,
      address,
      email,
      contact_number,
      gender,
      profile_path,
      profile_url,
    };

    if (password && password.trim() !== "") {
      updates.password = bcrypt.hashSync(password, 10);
    }

    const { error } = await supabase.from("users").update(updates).eq("id", id);
    if (error) throw error;

    res.redirect("/account");
  } catch (err) {
    console.error(err);
    res.status(500).send("Update error: " + err.message);
  }
});

// Delete user
router.post("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    // fetch user
    const { data, error: fErr } = await supabase.from("users").select("*").eq("id", id).single();
    if (fErr) throw fErr;

    if (data.profile_path) {
      try { await supabase.storage.from(USER_BUCKET).remove([data.profile_path]); } catch(e) { /* ignore */ }
    }

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;

    res.redirect("/account");
  } catch (err) {
    console.error(err);
    res.status(500).send("Delete error: " + err.message);
  }
});

export default router;
