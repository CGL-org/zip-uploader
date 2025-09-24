// routes/done.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DONE_BUCKET = "Completed";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ Completed files main page
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(DONE_BUCKET).list("");
    const isAdmin = req.session.user?.role === "admin";
    if (error) throw error;

    const rows = await Promise.all(
      data.map(async (f) => {
        let completedAt = "N/A";
        try {
          const { data: meta } = await supabase.storage.from(DONE_BUCKET).download(`${f.name}/.completed.json`);
          if (meta) {
            const txt = await meta.text();
            completedAt = JSON.parse(txt)?.completedAt || "N/A";
          }
        } catch {}
        return `
          <tr>
            <td data-label="Folder">${f.name}</td>
            <td data-label="Date Completed">${completedAt}</td>
            <td data-label="Action"><button onclick="openFolder('${f.name}')">View</button></td>
          </tr>
        `;
      })
    );

    res.send(`
<html>
<head>
<title>Completed Files</title>
<style>
:root {
  --sidebar-w: 240px;
  --brand: #004d40;
  --accent: #009688;
  --bg: #f4f6f9;
}

body { margin:0; font-family:'Segoe UI', Roboto, Arial, sans-serif; background:var(--bg); color:#222; }
header { background:var(--brand); color:white; padding:15px; text-align:center; font-size:1.25rem; position:fixed; left:0; right:0; top:0; z-index:900; }

/* Menu button */
#menuBtn {
  position: fixed; top:18px; left:18px; z-index:1100;
  background: var(--accent); color:white; border:none;
  padding:8px 12px; border-radius:6px; cursor:pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

/* Sidebar */
.sidebar {
  position:fixed; top:0; left: calc(-1 * var(--sidebar-w));
  width:var(--sidebar-w); height:100vh; background:var(--brand);
  color:white; padding-top:72px; transition:left .28s ease;
  box-shadow:2px 0 6px rgba(0,0,0,0.2); z-index:1000; overflow-y:auto;
}
.sidebar.active { left: 0; }

.sidebar .profile { text-align:center; padding:20px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent); }
.sidebar .profile img { width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid rgba(255,255,255,0.18); display:block; margin:0 auto 10px; }
.sidebar .profile h3 { margin:6px 0 2px; font-size:1rem; color:#fff; font-weight:600; }
.sidebar .profile p { margin:0; color:rgba(255,255,255,0.8); font-size:0.85rem; }

.sidebar .menu { padding:16px 8px; }
.sidebar .menu a {
  display:flex; align-items:center; gap:10px; padding:10px 14px; color: #fff;
  text-decoration:none; border-radius:8px; margin:8px 8px; transition: background .15s ease, transform .08s ease; font-weight:500;
}
.sidebar .menu a:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }

/* Content */
.content { transition: margin-left .28s ease; margin-left:0; }
.content.shifted { margin-left: var(--sidebar-w); }

.content .container { max-width:100%; margin:0 auto; padding:20px; box-sizing:border-box; }

/* Table */
table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:20px; }
thead { background:var(--accent); color:white; }
th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
tbody tr:nth-child(even) { background:#f9f9f9; }
button { background:var(--accent); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; }
button:hover { background:#00796b; }

/* Modal */
.modal-bg { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:none; justify-content:center; align-items:center; z-index:2000; }
.modal { background:#fff; padding:20px; border-radius:12px; max-width:900px; width:90%; max-height:85vh; overflow-y:auto; }
.modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:10px; }
.modal-header h2 { margin:0; font-size:1.2em; color:#004d40; }
.section-title { font-weight:bold; color:#004d40; margin:15px 0 8px; }
.image-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px; }
.image-grid img { width:100%; height:100px; object-fit:cover; border-radius:6px; cursor:pointer; transition:transform 0.2s; }
.image-grid img:hover { transform:scale(1.05); }
.file-list { list-style:none; padding:0; }
.file-list li { padding:6px 0; border-bottom:1px solid #eee; }
.modal-footer { text-align:right; margin-top:15px; }
.modal-footer button { background:#c62828; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }

/* Responsive Table */
@media(max-width:768px){
  table, thead, tbody, th, td, tr { display:block; }
  tr { margin-bottom:15px; }
  td { text-align:right; padding-left:50%; position:relative; }
  td::before { content:attr(data-label); position:absolute; left:10px; font-weight:bold; }
  th { display:none; }
}

/* Fullscreen image modal */
#imageModal { display:none; position:fixed; z-index:3000; padding-top:50px; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); }
#imageModal img { margin:auto; display:block; max-width:90%; max-height:90%; }
#imageModal span { position:absolute; top:20px; right:35px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer; }

/* Search input */
#searchInput { width:100%; padding:10px 12px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc; font-size:1em; box-shadow:0 1px 3px rgba(0,0,0,0.1); }

</style>
</head>
<body>
<header>✅ Completed Files</header>
<button id="menuBtn" aria-label="Toggle menu">☰ Menu</button>

<aside id="sidebar" class="sidebar" aria-label="Sidebar navigation">
  <div class="profile">
    <img src="${req.session.user?.profile_photo || 'https://via.placeholder.com/150?text=Profile'}" alt="Profile" />
    <h3>${req.session.user?.full_name || 'User'}</h3>
    <p>${req.session.user?.role || 'user'}</p>
  </div>
  <nav class="menu">
    <a href="/">🏠 Dashboard</a>
    <a href="/extracted">📂 Extracted Files</a>
    ${isAdmin ? `<a href="/account">👥 Accounts</a>` : ""}
    <a href="/logout">🚪 Logout</a>
  </nav>
</aside>

<div class="content" id="mainContent">
  <div class="container">
    <h2 style="margin-top:80px;">✅ Completed Folders</h2>
    <input type="text" id="searchInput" placeholder="🔍 Type to filter">
    <table>
      <thead>
        <tr><th>Folder</th><th>Date Completed</th><th>Action</th></tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  </div>
</div>

<div class="modal-bg" id="modalBg">
  <div class="modal">
    <div class="modal-header">
      <h2 id="folderTitle"></h2>
      <button onclick="closeModal()">✖ Close</button>
    </div>
    <div id="imageSection"></div>
    <div id="fileSection"></div>
    <div class="modal-footer">
      <button id="deleteBtn">🗑 Delete</button>
    </div>
  </div>
</div>

<div id="imageModal">
  <span onclick="closeImageModal()">&times;</span>
  <img id="fullImage">
</div>

<script>
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const content = document.getElementById("mainContent");

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  content.classList.toggle("shifted");
});

document.addEventListener("click", (e) => {
  if(!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains("active")){
    sidebar.classList.remove("active");
    content.classList.remove("shifted");
  }
});

let currentFolder = null;
async function openFolder(folder){
  currentFolder = folder;
  const res = await fetch('/done/'+folder+'/list');
  const data = await res.json();
  document.getElementById('folderTitle').innerText = folder;

  const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp'];
  const images = data.files.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
  const others = data.files.filter(f => !imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));

  document.getElementById('imageSection').innerHTML = images.length ? 
    '<div class="section-title">🖼 Images</div><div class="image-grid">' +
    images.map(f => '<img src="'+f.publicUrl+'" alt="'+f.name+'" onclick="openImageModal(\\''+f.publicUrl+'\\')">').join('') + '</div>' : "";

  document.getElementById('fileSection').innerHTML = others.length ? 
    '<div class="section-title">📄 Files</div><ul class="file-list">' +
    others.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('') + '</ul>' : "";

  document.getElementById('modalBg').style.display='flex';
  document.getElementById('deleteBtn').onclick = async () => {
    if(confirm("Delete folder '"+folder+"'?")) {
      const res = await fetch('/done/'+folder+'/delete', { method:'DELETE' });
      if(res.ok){ alert("Folder deleted."); window.location.reload(); }
      else { alert("Error deleting folder."); }
    }
  }
}

function closeModal(){ document.getElementById('modalBg').style.display='none'; }
function openImageModal(src){ document.getElementById("fullImage").src = src; document.getElementById("imageModal").style.display="block"; }
function closeImageModal(){ document.getElementById("imageModal").style.display="none"; }

const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const filter = searchInput.value.toLowerCase();
  document.querySelectorAll("table tbody tr").forEach(row => {
    const folderName = row.querySelector("td[data-label='Folder']").innerText.toLowerCase();
    row.style.display = folderName.includes(filter) ? "" : "none";
  });
});
</script>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// List contents of completed folder
router.get("/:folder/list", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(DONE_BUCKET).list(folder);
    if (error) throw error;

    const files = data.map(f => {
      const g = supabase.storage.from(DONE_BUCKET).getPublicUrl(`${folder}/${f.name}`);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete completed folder
router.delete("/:folder/delete", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data: files, error } = await supabase.storage.from(DONE_BUCKET).list(folder);
    if (error) throw error;

    if (!files || files.length === 0) return res.status(404).json({ error: "Folder not found" });

    await supabase.storage.from(DONE_BUCKET).remove(files.map(f => `${folder}/${f.name}`));
    res.json({ success: true, message: `Folder ${folder} deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
