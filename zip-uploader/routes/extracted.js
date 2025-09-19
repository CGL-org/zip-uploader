// routes/extracted.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXTRACTED_BUCKET = "Extracted_Files";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Extracted files main page
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list("");
    if (error) throw error;

    res.send(`
    <html>
    <head>
      <title>Extracted Files</title>
      <style>
        body { margin:0; font-family: Arial; background: #f4f6f9; }
        .sidebar {
          position:fixed; top:0; left:-220px; width:200px; height:100%;
          background:#004d40; color:white; padding-top:60px;
          transition:0.3s; overflow:hidden;
        }
        .sidebar a {
          display:block; padding:12px; color:white;
          text-decoration:none; font-weight:500;
        }
        .sidebar a:hover { background:#00796b; }
        #menuBtn {
          position:fixed; top:20px; left:0;
          background:#004d40; color:white; border:none;
          border-radius:0 6px 6px 0; width:40px; height:40px;
          cursor:pointer; z-index:1000;
        }
        .content { margin-left:20px; padding:20px; }
        table { width:100%; border-collapse:collapse; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
        thead { background:#009688; color:#fff; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:left; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        .modal-bg {
          position:fixed; top:0; left:0; width:100%; height:100%;
          background:rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          display:none; justify-content:center; align-items:center; z-index:2000;
        }
        .modal {
          background:#fff; padding:20px; border-radius:10px;
          max-width:600px; width:80%; max-height:80vh; overflow:auto;
          box-shadow:0 4px 15px rgba(0,0,0,0.3); position:relative;
        }
        .modal h2 { margin-top:0; }
        .close-btn {
          position:absolute; top:10px; right:10px;
          background:red; color:#fff; border:none; border-radius:4px;
          padding:6px 12px; cursor:pointer;
        }
        .delete-btn {
          position:absolute; top:10px; left:10px;
          background:#b71c1c; color:#fff; border:none; border-radius:4px;
          padding:6px 12px; cursor:pointer;
        }
      </style>
    </head>
    <body>
      <button id="menuBtn">▶</button>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="#">➕ Create Account</a>
        <a href="#">✏ Update Account</a>
        <a href="#">🗑 Delete Account</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h1>📂 Extracted Files</h1>
        <table>
          <thead><tr><th>Folder</th><th>Action</th></tr></thead>
          <tbody>
            ${data.map(f => `
              <tr>
                <td>${f.name}</td>
                <td><button onclick="openFolder('${f.name}')">View</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="modal-bg" id="modalBg">
        <div class="modal">
          <button class="delete-btn" id="deleteBtn">🗑 Delete</button>
          <button class="close-btn" onclick="closeModal()">✖ Close</button>
          <h2 id="folderTitle"></h2>
          <ul id="fileList"></ul>
        </div>
      </div>

      <script>
        const sidebar=document.getElementById("sidebar");
        const btn=document.getElementById("menuBtn");
        let open=false;
        btn.onclick=()=>{ 
          if(open){ sidebar.style.left="-220px"; btn.innerText="▶"; open=false; }
          else{ sidebar.style.left="0"; btn.innerText="◀"; open=true; }
        }

        let currentFolder = null;

        async function openFolder(folder) {
          currentFolder = folder;
          const res = await fetch('/extracted/'+folder+'/list');
          const data = await res.json();
          document.getElementById('folderTitle').innerText = folder;
          document.getElementById('fileList').innerHTML =
            data.files.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('');
          document.getElementById('modalBg').style.display='flex';

          // Bind delete button
          document.getElementById('deleteBtn').onclick = async () => {
            if(confirm("Are you sure you want to delete folder '"+folder+"'?")) {
              const del = await fetch('/extracted/'+folder+'/delete', { method:'DELETE' });
              if(del.ok){
                alert("Folder deleted.");
                window.location.reload();
              } else {
                alert("Error deleting folder.");
              }
            }
          }
        }

        function closeModal(){ document.getElementById('modalBg').style.display='none'; }
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// List contents of extracted folder
router.get("/:folder/list", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if (error) throw error;

    const files = data.map(f => {
      const g = supabase.storage.from(EXTRACTED_BUCKET).getPublicUrl(`${folder}/${f.name}`);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete folder and its files
router.delete("/:folder/delete", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if (error) throw error;

    const paths = data.map(f => `${folder}/${f.name}`);
    if (paths.length > 0) {
      const { error: delErr } = await supabase.storage.from(EXTRACTED_BUCKET).remove(paths);
      if (delErr) throw delErr;
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
