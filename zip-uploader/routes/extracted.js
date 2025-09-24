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
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list("");
    if (error) throw error;

    res.send(`
<html>
<head>
  <title>Extracted Files</title>
  <style>
    body { margin:0; font-family: Arial, sans-serif; background:#f4f6f9; }
    header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; position:sticky; top:0; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
    
:root { --sidebar-w: 240px; --brand:#004d40; --accent:#009688; --bg:#f4f6f9; }
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

.sidebar .menu { padding:16px 8px; }
.sidebar .menu a {
  display:flex; align-items:center; gap:10px; padding:10px 14px; color: #fff;
  text-decoration:none; border-radius:8px; margin:8px 8px; transition: background .15s ease, transform .08s ease; font-weight:500;
}
.sidebar .menu a:hover { background: rgba(255,255,255,0.05); transform: translateX(4px); }

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

.content { transition: margin-left .28s ease; margin-left: 0; }
.content.shifted { margin-left: var(--sidebar-w); }


    /* Table */
    table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); margin-top:20px; }
    thead { background:#009688; color:white; }
    th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; word-break:break-word; }
    tbody tr:nth-child(even) { background:#f9f9f9; }
    button { background:#009688; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; }
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
    .modal-footer button { background:#2e7d32; }

    /* Responsive Table */
    @media(max-width:768px){
      table, thead, tbody, th, td, tr { display:block; }
      tr { margin-bottom:15px; }
      td { text-align:right; padding-left:50%; position:relative; }
      td::before { content:attr(data-label); position:absolute; left:10px; font-weight:bold; }
      th { display:none; }
    }

#imageModal { display:none; position:fixed; z-index:3000; padding-top:50px; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); }
#imageModal img { margin:auto; display:block; max-width:90%; max-height:90%; }
#imageModal span { position:absolute; top:20px; right:35px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer; }

    
  </style>
</head>
<body>
  <header>📂 Extracted Files</header>
  <div id="menuBtn">☰ Menu</div>
  <aside id="sidebar" class="sidebar" aria-label="Sidebar navigation">
    <nav class="menu" role="navigation" aria-label="Main menu">
      <a href="/">🏠 Dashboard</a>
      <a href="/done">✅ Check and Complete</a>
      <a href="/logout">🚪 Logout</a>
    </nav>
  </aside>

<div class="content" id="mainContent">
  <h2>Available Folders</h2>
  
  <!-- Search bar inserted here -->
  <input type="text" id="searchInput" placeholder="🔍 Type to filter" style="
    width:100%; padding:10px 12px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc; font-size:1em;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  ">
  
    <table>
      <thead><tr><th>Folder</th><th>Date Extracted</th><th>Action</th></tr></thead>
      <tbody>
${await Promise.all(data.map(async f => {
  let extractedAt = "N/A";
  try {
    const { data: meta } = await supabase.storage
      .from(EXTRACTED_BUCKET)
      .download(`${f.name}/.extracted.json`);
    if (meta) {
      const text = await meta.text();
      const json = JSON.parse(text);
      extractedAt = json.extractedAt || "N/A";
    }
  } catch (e) {
    console.warn("meta read failed", f.name, e.message);
  }

  return `
  <tr>
    <td data-label="Folder">${f.name}</td>
    <td data-label="Date Extracted">${extractedAt}</td>
    <td data-label="Action"><button onclick="openFolder('${f.name}')">View</button></td>
  </tr>`;
})).then(rows => rows.join(""))}

      </tbody>
    </table>
  </div>

  <div class="modal-bg" id="modalBg">
    <div class="modal">
      <div class="modal-header">
        <h2 id="folderTitle"></h2>
        <button onclick="closeModal()">✖</button>
      </div>
      <div id="imageSection"></div>
      <div id="fileSection"></div>
      <div class="modal-footer">
        <button id="doneBtn">✅ Done</button>
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
    const mainContent = document.getElementById("mainContent");
    
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

    let currentFolder = null;
    async function openFolder(folder) {
      currentFolder = folder;
      const res = await fetch('/extracted/' + folder + '/list');
      const data = await res.json();
      document.getElementById('folderTitle').innerText = folder;

      const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp'];
      const images = data.files.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
      const others = data.files.filter(f => !imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));

      document.getElementById('imageSection').innerHTML = images.length ? 
  '<div class="section-title">🖼 Images</div><div class="image-grid">' +
  images.map(f => '<img src="'+f.publicUrl+'" alt="'+f.name+'" onclick="openImageModal(\\''+f.publicUrl+'\\')">').join('') + '</div>' : "";

      document.getElementById('fileSection').innerHTML = others.length ? '<div class="section-title">📄 Files</div><ul class="file-list">' + others.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('') + '</ul>' : "";

      document.getElementById('modalBg').style.display = 'flex';
      document.getElementById('doneBtn').onclick = async () => {
        if(confirm("Mark as Done?")){
          const r = await fetch('/extracted/' + folder + '/done',{method:'POST'});
          if(r.ok) location.reload();
        }
      };
    }

    function closeModal() { document.getElementById('modalBg').style.display = 'none'; }
   function openImageModal(src) {
      document.getElementById("fullImage").src = src;
      document.getElementById("imageModal").style.display = "block";
    }
    
    function closeImageModal() {
      document.getElementById("imageModal").style.display = "none";
    }

  // ✅ Search bar functionality
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => {
    const filter = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll("table tbody tr");
    rows.forEach(row => {
      const folderName = row.querySelector("td[data-label='Folder']").innerText.toLowerCase();
      row.style.display = folderName.includes(filter) ? "" : "none";
    });
  });
    
  </script>
</body>
</html>
    `);
  } catch (err) { res.status(500).send("Error: "+err.message); }
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
