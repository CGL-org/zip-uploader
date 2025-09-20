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

        /* Modal styles */
        .modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; }
        .modal-content { background:white; padding:20px; border-radius:8px; width:80%; max-width:600px; }
        .close { float:right; cursor:pointer; font-size:20px; }
        .file-list { margin-top:15px; text-align:left; }
        .file-list li { padding:5px 0; border-bottom:1px solid #ddd; }
        .danger { background:#c62828; }
        .danger:hover { background:#b71c1c; }
      </style>
    </head>
    <body>
      <header>✅ Check and Complete</header>
      <div id="menuArrow">➡</div>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="/done">✅ Check and Complete</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h2>Completed Folders</h2>
        <table>
          <thead><tr><th>Folder</th><th>Completed At</th><th>Action</th></tr></thead>
          <tbody>
            ${await Promise.all(data.map(async f => {
              let completedAt = "N/A";
              const { data: meta } = await supabase.storage.from(COMPLETED_BUCKET).download(`${f.name}/.completed.json`);
              if (meta) {
                const txt = await meta.text();
                try { completedAt = JSON.parse(txt).completedAt; } catch {}
              }
              return `<tr>
                        <td>${f.name}</td>
                        <td>${completedAt}</td>
                        <td><button onclick="viewFolder('${f.name}')">View</button></td>
                      </tr>`;
            })).then(rows => rows.join(""))}
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div id="folderModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="closeModal()">&times;</span>
          <h3 id="modalTitle">Folder</h3>
          <ul id="fileList" class="file-list"></ul>
          <button id="deleteBtn" class="danger">Delete Folder</button>
        </div>
      </div>

      <script>
        const sidebar = document.getElementById("sidebar");
        const menuArrow = document.getElementById("menuArrow");
        menuArrow.onclick = () => {
          if (sidebar.style.left === "0px") {
            sidebar.style.left = "-220px";
            menuArrow.innerHTML = "➡";
          } else {
            sidebar.style.left = "0px";
            menuArrow.innerHTML = "⬅";
          }
        };

        async function viewFolder(folder) {
          document.getElementById("modalTitle").innerText = "Folder: " + folder;
          const res = await fetch('/done/' + folder + '/files');
          const files = await res.json();
          const list = document.getElementById("fileList");
          list.innerHTML = files.map(f => "<li>" + f + "</li>").join("");
          document.getElementById("deleteBtn").onclick = () => deleteFolder(folder);
          document.getElementById("folderModal").style.display = "flex";
        }

        function closeModal() {
          document.getElementById("folderModal").style.display = "none";
        }

        async function deleteFolder(folder) {
          if (!confirm("Are you sure you want to delete " + folder + "?")) return;
          const res = await fetch('/done/' + folder + '/delete', { method:'DELETE' });
          const data = await res.json();
          if (data.ok) location.reload();
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

// Keep the move (done) route in case it’s used elsewhere
router.post("/:folder/done", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Folder not found in Extracted bucket" });
    }

    // Copy files to Completed
    for (const file of data) {
      const path = `${folder}/${file.name}`;
      const { data: fileData, error: dlErr } = await supabase.storage.from(EXTRACTED_BUCKET).download(path);
      if (dlErr) throw dlErr;

      const { error: upErr } = await supabase.storage.from(COMPLETED_BUCKET).upload(path, fileData, { upsert: true });
      if (upErr) throw upErr;
    }

    // Add metadata
    const meta = { completedAt: new Date().toISOString() };
    await supabase.storage.from(COMPLETED_BUCKET).upload(`${folder}/.completed.json`, JSON.stringify(meta), { upsert: true });


    // Delete from Extracted
    const paths = data.map(f => `${folder}/${f.name}`);
    await supabase.storage.from(EXTRACTED_BUCKET).remove(paths);

    res.json({ ok: true, moved: folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
