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
        body { margin:0; font-family: Arial, sans-serif; background:#f4f6f9; }
        header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
        
        /* Sidebar */
        .sidebar {
          position:fixed; top:0; left:-220px; width:200px; height:100%;
          background:#004d40; color:white; padding-top:60px;
          transition:0.3s; z-index:999;
        }
        .sidebar a {
          display:block; padding:12px; color:white; text-decoration:none; font-weight:500;
        }
        .sidebar a:hover { background:#00796b; }
        
        /* Sidebar toggle arrow */
        #menuArrow {
          position:fixed; top:50%; left:0;
          background:#004d40; color:white; padding:8px;
          border-radius:0 5px 5px 0; cursor:pointer;
          z-index:1000;
        }
        
        /* Page content */
        .content { padding:20px; margin-left:20px; }
        table { width:100%; border-collapse:collapse; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        thead { background:#009688; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
        
        /* Modal background */
        .modal-bg {
          position:fixed; top:0; left:0; width:100%; height:100%;
          background:rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          display:none; justify-content:center; align-items:center; z-index:2000;
        }
        
        /* Modal box */
        .modal {
          background:#fff; padding:20px; border-radius:12px;
          max-width:900px; width:90%; max-height:85vh; overflow-y:auto;
          box-shadow:0 6px 20px rgba(0,0,0,0.25);
        }
        
        /* Modal header */
        .modal-header {
          display:flex; justify-content:space-between; align-items:center;
          border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:15px;
        }
        .modal-header h2 { margin:0; font-size:1.3em; color:#004d40; }
        .modal-header button {
          background:#333; color:#fff; border:none; padding:6px 12px;
          border-radius:6px; cursor:pointer;
        }
        
        /* Section titles */
        .section-title {
          font-size:1.1em; font-weight:bold; color:#004d40;
          margin:15px 0 10px;
        }

        /* Image grid */
        .image-grid {
          display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));
          gap:10px;
        }
        .image-grid img {
          width:100%; height:100px; object-fit:cover;
          border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.2);
          cursor:pointer; transition:transform 0.2s;
        }
        .image-grid img:hover { transform:scale(1.05); }

        /* File list */
        .file-list { list-style:none; padding:0; margin:0; }
        .file-list li {
          padding:8px 0; border-bottom:1px solid #eee;
          word-wrap:break-word; white-space:normal;
        }
        .file-list a {
          text-decoration:none; color:#00796b; font-weight:500;
        }
        
        /* Modal footer */
        .modal-footer {
          text-align:right; margin-top:15px;
        }
        .modal-footer button {
          background:#b71c1c; color:#fff; border:none; padding:8px 14px;
          border-radius:6px; cursor:pointer;
        }

        /* Fullscreen image modal */
        #imageModal {
          display:none; position:fixed; z-index:3000; padding-top:50px;
          left:0; top:0; width:100%; height:100%;
          background-color:rgba(0,0,0,0.9);
        }
        #imageModal img {
          margin:auto; display:block; max-width:90%; max-height:90%;
        }
        #imageModal span {
          position:absolute; top:20px; right:35px;
          color:#fff; font-size:40px; font-weight:bold;
          cursor:pointer;
        }
      </style>
    </head>
    <body>
      <header>📂 Extracted Files</header>
      <div id="menuArrow">➡</div>
      <div id="sidebar" class="sidebar">
        <a href="/">🏠 Dashboard</a>
        <a href="/extracted">📂 Extracted Files</a>
        <a href="#">➕ Create Account</a>
        <a href="#">✏ Update Account</a>
        <a href="#">🗑 Delete Account</a>
        <a href="/logout">🚪 Logout</a>
      </div>

      <div class="content">
        <h2>Available Folders</h2>
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
            <button id="deleteBtn">🗑 Delete Folder</button>
          </div>
        </div>
      </div>

      <!-- Fullscreen Image Modal -->
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

          // Render images
          if(images.length > 0){
            document.getElementById('imageSection').innerHTML = 
              '<div class="section-title">🖼 Images</div>' +
              '<div class="image-grid">' +
              images.map(f => '<img src="'+f.publicUrl+'" alt="'+f.name+'" onclick="openImageModal(\\''+f.publicUrl+'\\')">').join('') +
              '</div>';
          } else {
            document.getElementById('imageSection').innerHTML = "";
          }

          // Render other files
          if(others.length > 0){
            document.getElementById('fileSection').innerHTML = 
              '<div class="section-title">📄 Files</div>' +
              '<ul class="file-list">' +
              others.map(f => '<li><a href="'+f.publicUrl+'" target="_blank">'+f.name+'</a></li>').join('') +
              '</ul>';
          } else {
            document.getElementById('fileSection').innerHTML = "";
          }

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

        // Image fullscreen modal
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

// Delete folder and its files
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
