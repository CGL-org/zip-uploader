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
    if (error) throw error;

    res.send(`
    <html>
    <head>
      <title>Completed Files</title>
      <style>
        body { margin:0; font-family: Arial, sans-serif; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; position:relative; }
        #menuBtn { position:absolute; left:15px; top:15px; background:#00796b; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:1em; }
        
        .sidebar { position:fixed; top:0; left:-240px; width:220px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; z-index:1000; }
        .sidebar.active { left:0; }
        .sidebar a { display:block; padding:12px 18px; color:white; text-decoration:none; font-weight:500; }
        .sidebar a:hover { background:#00796b; }

        .content { padding:20px; margin-top:20px; }
        table { width:100%; border-collapse:collapse; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        thead { background:#009688; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        button { background:#009688; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }
        button:hover { background:#00796b; }

        /* Responsive table */
        @media(max-width:768px){
          table, thead, tbody, th, td, tr { display:block; width:100%; }
          thead { display:none; }
          tr { margin-bottom:15px; background:white; border-radius:6px; padding:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
          td { text-align:right; padding-left:50%; position:relative; }
          td::before { content:attr(data-label); position:absolute; left:10px; width:45%; font-weight:bold; text-align:left; }
        }

        /* Modal */
        .modal-bg { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter: blur(6px); display:none; justify-content:center; align-items:center; z-index:2000; }
        .modal { background:#fff; padding:20px; border-radius:12px; max-width:900px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 6px 20px rgba(0,0,0,0.25); }
        .modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:15px; }
        .modal-header h2 { margin:0; font-size:1.3em; color:#004d40; }
        .modal-header button { background:#333; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }
        .section-title { font-size:1.1em; font-weight:bold; color:#004d40; margin:15px 0 10px; }
        .image-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px; }
        .image-grid img { width:100%; height:100px; object-fit:cover; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer; transition:transform 0.2s; }
        .image-grid img:hover { transform:scale(1.05); }
        .file-list { list-style:none; padding:0; margin:0; }
        .file-list li { padding:8px 0; border-bottom:1px solid #eee; }
        .file-list a { text-decoration:none; color:#00796b; font-weight:500; }
        .modal-footer { text-align:right; margin-top:15px; }
        .modal-footer button { background:#c62828; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; }

        #imageModal { display:none; position:fixed; z-index:3000; padding-top:50px; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); }
        #imageModal img { margin:auto; display:block; max-width:90%; max-height:90%; }
        #imageModal span { position:absolute; top:20px; right:35px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer; }
      </style>
    </head>
    <body>
      <header>
        <button id="menuBtn">☰ Menu</button>
        ✅ Completed Files
      </header>
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
          <thead><tr><th>Folder</th><th>Date Completed</th><th>Action</th></tr></thead>
          <tbody>
            ${await Promise.all(data.map(async f => {
              let completedAt = "N/A";
              const { data: meta } = await supabase.storage
                .from(DONE_BUCKET)
                .download(`${f.name}/.completed.json`);
              if (meta) {
                const txt = await meta.text();
                try { completedAt = JSON.parse(txt).completedAt; } catch {}
              }
              return `
                <tr>
                  <td data-label="Folder">\${f.name}</td>
                  <td data-label="Date Completed">\${completedAt}</td>
                  <td data-label="Action"><button onclick="openFolder('\${f.name}')">View</button></td>
                </tr>\`;
            })).then(rows => rows.join(""))}
          </tbody>
        </table>
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

      <div id="imageModal"><span onclick="closeImageModal()">&times;</span><img id="fullImage"></div>

      <script>
        const menuBtn=document.getElementById("menuBtn");
        const sidebar=document.getElementById("sidebar");
        menuBtn.addEventListener("click",()=> sidebar.classList.toggle("active"));

        let currentFolder = null;
        async function openFolder(folder) {
          currentFolder = folder;
          const res = await fetch('/done/'+folder+'/list');
          const data = await res.json();
          document.getElementById('folderTitle').innerText = folder;

          const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp'];
          const images = data.files.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
          const others = data.files.filter(f => !imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));

          if(images.length > 0){
            document.getElementById('imageSection').innerHTML = '<div class="section-title">🖼 Images</div><div class="image-grid">' + images.map(f => '<img src="'+f.publicUrl+'" alt="'+f.name+'" onclick="openImageModal(\\''+f.publicUrl+'\\')">').join('') + '</div>';
          } else { document.getElementById('imageSection').innerHTML = ""; }

          if(others.length > 0){
            document.getElementById('fileSection').innerHTML = '<div class="section-title">📄 Files</div><ul class="file-list">' + others.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('') + '</ul>';
          } else { document.getElementById('fileSection').innerHTML = ""; }

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
        function openImageModal(src){ document.getElementById("fullImage").src = src; document.getElementById("imageModal").style.display = "block"; }
        function closeImageModal(){ document.getElementById("imageModal").style.display = "none"; }
      </script>
    </body>
    </html>
    `;
  } catch (err) { res.status(500).send("Error: " + err.message); }
});

// 📂 List contents of completed folder
router.get("/:folder/list", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(DONE_BUCKET).list(folder);
    if (error) throw error;

    const files = data.map(f => {
      const g = supabase.storage.from(DONE_BUCKET).getPublicUrl(\`\${folder}/\${f.name}\`);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑 Delete completed folder
router.delete("/:folder/delete", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data: files, error: listErr } = await supabase.storage.from(DONE_BUCKET).list(folder);
    if (listErr) throw listErr;

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    await supabase.storage.from(DONE_BUCKET).remove(files.map(f => \`\${folder}/\${f.name}\`));

    res.json({ success: true, message: \`Folder \${folder} deleted.\` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
