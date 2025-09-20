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
      <style>
        body { margin:0; font-family: Arial; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
        table { width:100%; border-collapse: collapse; margin-top:20px; background:white; }
        th, td { padding:12px; border:1px solid #ddd; text-align:left; }
        th { background:#00796b; color:white; }
        tr:hover { background:#f1f1f1; }
        button { padding:6px 12px; background:#00796b; color:white; border:none; border-radius:4px; cursor:pointer; }
        button:hover { background:#004d40; }
        .modal-bg { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; }
        .modal { background:white; padding:20px; width:90%; max-width:800px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3); }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .modal-header h2 { margin:0; font-size:1.2em; }
        .modal-header button { background:#e53935; }
        .modal-header button:hover { background:#ab000d; }
        .modal-footer { margin-top:20px; text-align:right; }
        .section-title { font-weight:bold; margin-top:15px; margin-bottom:8px; }
        .image-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
        .image-grid img { width:100%; height:120px; object-fit:cover; border-radius:6px; cursor:pointer; transition:transform 0.2s; }
        .image-grid img:hover { transform: scale(1.05); }
        .file-list { list-style:none; padding:0; }
        .file-list li { margin-bottom:8px; }
        .file-list a { color:#00796b; text-decoration:none; }
        .file-list a:hover { text-decoration:underline; }
        /* Sidebar */
        .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; }
        .sidebar a { padding:10px 15px; display:block; color:white; text-decoration:none; }
        .sidebar a:hover { background:#00796b; }
        #menuArrow { position:fixed; top:15px; left:15px; font-size:20px; color:white; background:#00796b; padding:5px 10px; border-radius:4px; cursor:pointer; z-index:1000; }
        /* Image modal full view */
        #imageModal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); justify-content:center; align-items:center; z-index:2000; }
        #imageModal img { max-width:90%; max-height:80%; border-radius:8px; }
        #imageModal span { position:absolute; top:20px; right:35px; color:white; font-size:40px; font-weight:bold; cursor:pointer; }
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
        <h2 style="margin-left:15px;">Available Folders</h2>
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

      <div class="modal-bg" id="modalBg">
        <div class="modal">
          <div class="modal-header">
            <h2 id="folderTitle"></h2>
            <button onclick="closeModal()">✖ Close</button>
          </div>
          <div id="imageSection"></div>
          <div id="fileSection"></div>
          <div class="modal-footer">
            <!-- Changed Delete to Done -->
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

          // Bind the Done button
          document.getElementById('doneBtn').onclick = async () => {
            if(confirm("Mark folder '"+folder+"' as Done? It will move to Completed.")) {
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

        function openImageModal(src){
          document.getElementById("fullImage").src = src;
          document.getElementById("imageModal").style.display = "flex";
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

// List contents of extracted folder
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

export default router;
