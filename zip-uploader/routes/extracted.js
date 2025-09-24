// routes/extracted.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXTRACTED_BUCKET = "Extracted_Files";
const DONE_BUCKET = "Completed"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 📂 Extracted files page
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


// list files
router.get("/:folder/list", async (req,res)=>{
  const folder=req.params.folder;
  try{
    const {data,error}=await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if(error) throw error;
    const files=data.map(f=>{
      const g=supabase.storage.from(EXTRACTED_BUCKET).getPublicUrl(`${folder}/${f.name}`);
      return {...f,publicUrl:g?.data?.publicUrl||null};
    });
    res.json({files});
  }catch(err){res.status(500).json({error:err.message});}
});

// mark done
router.post("/:folder/done", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data: files, error: listErr } = await supabase.storage
      .from(EXTRACTED_BUCKET)
      .list(folder);

    if (listErr) throw listErr;

    for (const f of files) {
      const path = `${folder}/${f.name}`; // ✅ safe template literal
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(EXTRACTED_BUCKET)
        .download(path);

      if (dlErr) throw dlErr;

      await supabase.storage.from(DONE_BUCKET).upload(path, fileData, { upsert: true });
    }

    // ✅ Correct — proper template literal
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

const completedAt = formatDateTime();

await supabase.storage
  .from(DONE_BUCKET)
  .upload(`${folder}/.completed.json`, JSON.stringify({ completedAt }), { upsert: true });


    // ✅ Correct — map with template literal
    await supabase.storage
      .from(EXTRACTED_BUCKET)
      .remove(files.map(f => `${folder}/${f.name}`));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
