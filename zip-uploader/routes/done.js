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
        .btn { background:#1b5e20; color:white; padding:6px 12px; border:none; border-radius:4px; cursor:pointer; }
        .btn:hover { background:#388e3c; }
        /* Modal */
        .modal { display:none; position:fixed; z-index:2000; left:0; top:0; width:100%; height:100%; overflow:auto; background:rgba(0,0,0,0.4); }
        .modal-content { background:#fff; margin:10% auto; padding:20px; border-radius:8px; width:400px; text-align:center; box-shadow:0 4px 8px rgba(0,0,0,0.2); }
        .close { float:right; font-size:20px; cursor:pointer; }
        .delete-btn { background:#c62828; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer; }
        .delete-btn:hover { background:#e53935; }
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
              const { data: meta } = await supabase.storage.from(COMPLETED_BUCKET).download(\`\${f.name}/.completed.json\`);
              if (meta) {
                const txt = await meta.text();
                try { completedAt = JSON.parse(txt).completedAt; } catch {}
              }
              return \`
                <tr>
                  <td>\${f.name}</td>
                  <td>\${completedAt}</td>
                  <td><button class="btn" onclick="openModal('\${f.name}')">View</button></td>
                </tr>\`;
            })).then(rows => rows.join(""))}
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div id="folderModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="closeModal()">&times;</span>
          <h2 id="modalFolder"></h2>
          <p>Do you want to <b>delete this completed folder</b>?</p>
          <button class="delete-btn" id="deleteBtn">Delete Folder</button>
        </div>
      </div>

      <script>
        let currentFolder = "";

        function openModal(folder) {
          currentFolder = folder;
          document.getElementById("modalFolder").innerText = "📂 " + folder;
          document.getElementById("folderModal").style.display = "block";
        }

        function closeModal() {
          document.getElementById("folderModal").style.display = "none";
        }

        document.getElementById("deleteBtn").addEventListener("click", async () => {
          if (!currentFolder) return;
          const res = await fetch('/done/' + currentFolder, { method: 'DELETE' });
          const data = await res.json();
          if (data.ok) {
            alert("Folder deleted successfully!");
            location.reload();
          } else {
            alert("Error: " + data.error);
          }
        });

        // Sidebar toggle
        const sidebar = document.getElementById("sidebar");
        const menuArrow = document.getElementById("menuArrow");
        let open = false;
        menuArrow.addEventListener("click", () => {
          if (!open) {
            sidebar.style.left = "0";
            menuArrow.innerText = "⬅";
            open = true;
          } else {
            sidebar.style.left = "-220px";
            menuArrow.innerText = "➡";
            open = false;
          }
        });
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// Delete folder from Completed bucket
router.delete("/:folder", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list(folder);
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Folder not found in Completed bucket" });
    }

    const paths = data.map(f => \`\${folder}/\${f.name}\`);
    await supabase.storage.from(COMPLETED_BUCKET).remove(paths);

    res.json({ ok: true, deleted: folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
