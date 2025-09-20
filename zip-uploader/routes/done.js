// routes/done.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXTRACTED_BUCKET = "Extracted_Files";
const COMPLETED_BUCKET = "Completed";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Completed files main page
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list("");
    if (error) throw error;

    res.send(`
    <html>
    <head>
      <title>Check and Complete</title>
      <style>
        body { margin:0; font-family: Arial, sans-serif; background:#f4f6f9; }
        header { background:#1b5e20; color:white; padding:15px; text-align:center; font-size:1.5em; }
        .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#1b5e20; color:white; padding-top:60px; transition:0.3s; z-index:999; }
        .sidebar a { display:block; padding:12px; color:white; text-decoration:none; font-weight:500; }
        .sidebar a:hover { background:#388e3c; }
        #menuArrow { position:fixed; top:50%; left:0; background:#1b5e20; color:white; padding:8px; border-radius:0 5px 5px 0; cursor:pointer; z-index:1000; }
        .content { padding:20px; margin-left:20px; }
        table { width:100%; border-collapse:collapse; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        thead { background:#2e7d32; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        button { background:#2e7d32; color:white; border:none; padding:6px 12px; cursor:pointer; border-radius:4px; }
        button:hover { background:#1b5e20; }

        /* Floating modal styles (same as extracted.js) */
        .modal-bg { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter: blur(6px); display:none; justify-content:center; align-items:center; z-index:2000; }
        .modal { background:#fff; padding:20px; border-radius:12px; max-width:900px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 6px 20px rgba(0,0,0,0.25); }
        .modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:15px; }
        .modal-header h2 { margin:0; font-size:1.3em; color:#1b5e20; }
        .modal-header button { background:#333; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }
        .section-title { font-size:1.1em; font-weight:bold; color:#1b5e20; margin:15px 0 10px; }
        .file-list { list-style:none; padding:0; margin:0; }
        .file-list li { padding:8px 0; border-bottom:1px solid #eee; word-wrap:break-word; white-space:normal; }
        .file-list a { text-decoration:none; color:#2e7d32; font-weight:500; }
        .modal-footer { text-align:right; margin-top:15px; }
        .modal-footer button { background:#c62828; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; }
        .modal-footer button:hover { background:#b71c1c; }
      </style>
    </head>
    <body>
      <header>✅ Check and Complete</header>
      <div id="menuArrow">➡</div>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="/done">✅ Check and Complete</a>
        <a href="#">➕ Create Account</a>
        <a href="#">✏ Update Account</a>
        <a href="#">🗑 Delete Account</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h2>Completed Folders</h2>
        <table>
          <thead><tr><th>Folder</th><th>Completed At</th><th>Action</th></tr></thead>
<tbody>
  ${await Promise.all(data.map(async f => {
    let completedAt = "N/A";

    const { data: meta } = await supabase.storage
      .from(COMPLETED_BUCKET)
      .download(`${f.name}/.completed.json`);

    if (meta) {
      const txt = await meta.text();
      try { completedAt = JSON.parse(txt).completedAt; } catch {}
    }

    return `
      <tr>
        <td>${f.name}</td>
        <td>${completedAt}</td>
        <td><button onclick="viewFolder('${f.name}')">View</button></td>
      </tr>
    `;
  })).then(rows => rows.join(""))}
</tbody>
        </table>
      </div>

      <!-- Floating Modal -->
      <div class="modal-bg" id="modalBg">
        <div class="modal">
          <div class="modal-header">
            <h2 id="modalTitle"></h2>
            <button onclick="closeModal()">✖ Close</button>
          </div>
          <div id="fileSection"></div>
          <div class="modal-footer">
            <button id="deleteBtn">🗑 Delete Folder</button>
          </div>
        </div>
      </div>

      <script>
        const menuArrow=document.getElementById("menuArrow");
        const sidebar=document.getElementById("sidebar");
        menuArrow.addEventListener("click",()=> {
          sidebar.classList.toggle("active");
          if(sidebar.classList.contains("active")) { sidebar.style.left="0"; menuArrow.style.display="none"; }
          else { sidebar.style.left="-220px"; menuArrow.style.display="block"; }
        });
        document.addEventListener("click",(e)=>{ if(!sidebar.contains(e.target) && !menuArrow.contains(e.target)){ sidebar.classList.remove("active"); sidebar.style.left="-220px"; menuArrow.style.display="block"; } });

        async function viewFolder(folder) {
          document.getElementById("modalTitle").innerText = "Folder: " + folder;
          const res = await fetch('/done/' + folder + '/files');
          const files = await res.json();
          const section = document.getElementById("fileSection");

          if(files.length > 0){
            section.innerHTML = '<div class="section-title">📄 Files</div><ul class="file-list">' + files.map(f => '<li>' + f + '</li>').join('') + '</ul>';
          } else { section.innerHTML = "<p>No files found.</p>"; }

          document.getElementById("deleteBtn").onclick = () => deleteFolder(folder);
          document.getElementById("modalBg").style.display='flex';
        }

        function closeModal(){ document.getElementById("modalBg").style.display='none'; }

        async function deleteFolder(folder) {
          if (!confirm("Are you sure you want to delete '" + folder + "'?")) return;
          const res = await fetch('/done/' + folder + '/delete', { method:'DELETE' });
          const data = await res.json();
          if (data.ok) { alert("Folder deleted."); window.location.reload(); }
          else alert("Error: " + data.error);
        }
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// API: Get files in a folder
router.get("/:folder/files", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list(folder);
    if (error) throw error;

    const files = data.filter(f => f.name !== ".completed.json").map(f => f.name);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete folder
router.delete("/:folder/delete", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list(folder);
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const paths = data.map(f => `${folder}/${f.name}`);
    await supabase.storage.from(COMPLETED_BUCKET).remove(paths);

    res.json({ ok: true, deleted: folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
