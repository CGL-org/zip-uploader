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

// ========== PAGE: Extracted Files ==========
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list("");
    if (error) throw error;

    res.send(`
    <html>
    <head>
      <title>Extracted Files</title>
      <style>
        body { margin:0; font-family: Arial; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th,td { border:1px solid #ddd; padding:10px; text-align:left; }
        th { background:#004d40; color:white; }
        tr:nth-child(even) { background:#f2f2f2; }
        button { background:#00796b; color:white; border:none; padding:5px 10px; cursor:pointer; }
        button:hover { background:#004d40; }
        .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; z-index:100; }
        .sidebar a { padding:10px 15px; display:block; color:white; text-decoration:none; }
        .sidebar a:hover { background:#00796b; }
        #menuArrow { position:fixed; top:15px; left:15px; cursor:pointer; background:#004d40; color:white; padding:10px; border-radius:5px; z-index:101; }
        .content { padding:20px; margin-left:20px; }
        .modal-bg { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center; z-index:200; }
        .modal { background:white; padding:20px; border-radius:10px; width:80%; max-height:90%; overflow-y:auto; }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .modal-footer { text-align:right; margin-top:10px; }
        .image-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin-top:10px; }
        .image-grid img { width:100%; height:100px; object-fit:cover; cursor:pointer; border-radius:8px; }
        .section-title { font-weight:bold; margin-top:15px; }
        .file-list { list-style:none; padding:0; margin:0; }
        .file-list li { margin:5px 0; }
        .file-list a { color:#00796b; text-decoration:none; }
        .file-list a:hover { text-decoration:underline; }
        /* Fullscreen image modal */
        #imageModal { display:none; position:fixed; z-index:300; padding-top:60px; left:0; top:0; width:100%; height:100%; overflow:auto; background-color:rgba(0,0,0,0.9); }
        #imageModal img { margin:auto; display:block; max-width:80%; max-height:80%; }
        #imageModal span { position:absolute; top:30px; right:35px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer; }
      </style>
    </head>
    <body>
      <header>📂 Extracted Files</header>
      <div id="menuArrow">➡</div>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="/done">✅ Check and Complete</a>
        <a href="/logout">🚪 Logout</a>
      </div>
      <div class="content">
        <h2>Available Folders</h2>
        <table>
          <thead><tr><th>Folder</th><th>Date Extracted</th><th>Action</th></tr></thead>
          <tbody>
            ${await Promise.all(data.map(async f => {
              let extractedAt = "N/A";
              const { data: meta, error: metaErr } = await supabase.storage.from(EXTRACTED_BUCKET).download(\`\${f.name}/.extracted.json\`);
              if (!metaErr && meta) {
                const txt = await meta.text();
                try { extractedAt = JSON.parse(txt).extractedAt; } catch {}
              }
              return \`
                <tr>
                  <td>\${f.name}</td>
                  <td>\${extractedAt}</td>
                  <td><button onclick="openFolder('\${f.name}')">View</button></td>
                </tr>\`;
            })).then(rows => rows.join(""))}
          </tbody>
        </table>
      </div>

      <!-- Folder modal -->
      <div class="modal-bg" id="modalBg">
        <div class="modal">
          <div class="modal-header">
            <h2 id="folderTitle"></h2>
            <button onclick="closeModal()">✖ Close</button>
          </div>
          <div id="imageSection"></div>
          <div id="fileSection"></div>
          <div class="modal-footer">
            <button id="doneBtn">✅ Done</button>
          </div>
        </div>
      </div>

      <!-- Fullscreen image modal -->
      <div id="imageModal">
        <span onclick="closeImageModal()">&times;</span>
        <img id="fullImage">
      </div>

      <script>
        const menuArrow=document.getElementById("menuArrow");
        const sidebar=document.getElementById("sidebar");
        menuArrow.addEventListener("click",()=> {
          sidebar.classList.toggle("active");
          if(sidebar.classList.contains("active")) {
            sidebar.style.left="0";
            menuArrow.style.display="none";
          } else {
            sidebar.style.left="-220px";
            menuArrow.style.display="block";
          }
        });
        document.addEventListener("click",(e)=>{
          if(!sidebar.contains(e.target) && !menuArrow.contains(e.target)){
            sidebar.classList.remove("active");
            sidebar.style.left="-220px";
            menuArrow.style.display="block";
          }
        });

        let currentFolder = null;

        async function openFolder(folder) {
          currentFolder = folder;
          const res = await fetch('/extracted/'+folder+'/list');
          const data = await res.json();
          document.getElementById('folderTitle').innerText = folder;

          const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp'];
          const images = data.files.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
          const others = data.files.filter(f => !imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));

          if(images.length > 0){
            document.getElementById('imageSection').innerHTML = 
              '<div class="section-title">🖼 Images</div>' +
              '<div class="image-grid">' +
              images.map(f => '<img src="'+f.publicUrl+'" alt="'+f.name+'" onclick="openImageModal(\\''+f.publicUrl+'\\')">').join('') +
              '</div>';
          } else { document.getElementById('imageSection').innerHTML = ""; }

          if(others.length > 0){
            document.getElementById('fileSection').innerHTML = 
              '<div class="section-title">📄 Files</div>' +
              '<ul class="file-list">' +
              others.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('') +
              '</ul>';
          } else { document.getElementById('fileSection').innerHTML = ""; }

          document.getElementById('modalBg').style.display='flex';

          // Bind Done button
          document.getElementById('doneBtn').onclick = async () => {
            if(confirm("Mark '"+folder+"' as Done? This moves it to Completed.")) {
              const move = await fetch('/done/'+folder+'/done', { method:'POST' });
              if(move.ok){
                alert("Folder moved to Completed.");
                window.location.reload();
              } else {
                alert("Error moving folder.");
              }
            }
          }
        }

        function closeModal(){ document.getElementById('modalBg').style.display='none'; }

        // image expand modal
        function openImageModal(src){
          document.getElementById("fullImage").src = src;
          document.getElementById("imageModal").style.display = "block";
        }
        function closeImageModal(){
          document.getElementById("imageModal").style.display = "none";
        }
      </script>
    </body>
    </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// ========== API: List files inside folder ==========
router.get("/:folder/list", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if (error) throw error;

    const files = data.map(f => {
      const g = supabase.storage.from(EXTRACTED_BUCKET).getPublicUrl(\`\${folder}/\${f.name}\`);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== API: Delete folder (optional) ==========
router.delete("/:folder/delete", async (req, res) => {
  const folder = req.params.folder;
  try {
    const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
    if (error) throw error;

    const paths = data.map(f => \`\${folder}/\${f.name}\`);
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
