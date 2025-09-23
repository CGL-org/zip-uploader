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


// 📂 Extracted files page
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list("");
    if (error) throw error;

    // Build table rows separately
    const rows = await Promise.all(data.map(async f => {
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
    }));

    res.send(`
<html>
<head>
  <title>Extracted Files</title>
  <style>
    body { margin:0; font-family: Arial, sans-serif; background:#f4f6f9; }
    header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; position:sticky; top:0; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
    
    /* Sidebar */
    #menuBtn {
      position: fixed; top:15px; left:15px; background:#00796b;
      color:white; border:none; padding:10px 14px; border-radius:6px;
      cursor:pointer; font-size:1em; z-index:1001;
      box-shadow:0 2px 4px rgba(0,0,0,0.2);
    }

    .sidebar {
      position: fixed; top:0; left:-240px; width:220px; height:100%;
      background:#004d40; color:white; padding-top:60px; transition:0.3s;
      box-shadow: 2px 0 6px rgba(0,0,0,0.2); z-index:1000;
    }
    .sidebar a { display:block; padding:14px 18px; color:white; text-decoration:none; font-weight:500; transition:0.2s; }
    .sidebar a:hover { background:#00796b; padding-left:25px; }

    /* Content */
    .content { transition: margin-left 0.3s; padding:20px; margin-left:0; }
    .content.active { margin-left:220px; }

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
  </style>
</head>
<body>

<!-- Image Fullscreen Modal -->
<div class="modal-bg" id="imgModalBg">
  <div class="modal" style="max-width:95%; max-height:95%; padding:0; background:transparent; box-shadow:none;">
    <img id="imgPreview" src="" alt="Preview" style="width:100%; height:auto; border-radius:8px;">
  </div>
</div>

  <header>📂 Extracted Files</header>
  <div id="menuBtn">☰ Menu</div>
  <div id="sidebar" class="sidebar">
    <a href="/">🏠 Dashboard</a>
    <a href="/done">✅ Check and Complete</a>
    <a href="/logout">🚪 Logout</a>
  </div>

  <div class="content" id="mainContent">
    <h2>Available Folders</h2>
    <table>
      <thead><tr><th>Folder</th><th>Date Extracted</th><th>Action</th></tr></thead>
<tbody>
  ${rows.join("")}
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

  <script>

// Image fullscreen preview
function openImage(src) {
  const modalBg = document.getElementById("imgModalBg");
  const img = document.getElementById("imgPreview");
  img.src = src;
  modalBg.style.display = "flex";
}
document.getElementById("imgModalBg").addEventListener("click", () => {
  document.getElementById("imgModalBg").style.display = "none";
});
  
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");
    const content = document.getElementById("mainContent");

    menuBtn.addEventListener("click", () => {
      const isOpen = sidebar.style.left === "0px" || sidebar.style.left === "0";
      sidebar.style.left = isOpen ? "-240px" : "0";
      content.classList.toggle("active", !isOpen);
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

document.getElementById('imageSection').innerHTML = images.length 
  ? '<div class="section-title">🖼 Images</div><div class="image-grid">' 
      + images.map(f => {
          return `<img src="${f.publicUrl}" alt="${f.name}" class="preview-img" data-url="${f.publicUrl}">`;
        }).join('') 
      + '</div>' 
  : "";


// Attach click handlers safely
document.querySelectorAll('.preview-img').forEach(img => {
  img.addEventListener('click', () => openImage(img.dataset.url));
});


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
    await supabase.storage
      .from(DONE_BUCKET)
      .upload(
        `${folder}/.completed.json`,
        JSON.stringify({ completedAt: formatDateTime() }),
        { upsert: true }
      );

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
