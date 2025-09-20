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

// Extracted Dashboard
router.get("/", async (req, res) => {
  try {
    const { data: files, error } = await supabase.storage
      .from(EXTRACTED_BUCKET)
      .list("", { limit: 100, offset: 0 });
    if (error) throw error;

    const folders = files.filter(f => f.metadata && f.metadata.name === undefined);

    const folderData = await Promise.all(
      folders.map(async folder => {
        const { data } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder.name);
        const metaFile = data.find(f => f.name.endsWith(".extracted.json"));
        let extractedDate = "N/A";

        if (metaFile) {
          const { data: meta } = await supabase.storage.from(EXTRACTED_BUCKET).download(`${folder.name}/${metaFile.name}`);
          const txt = await meta.text();
          const json = JSON.parse(txt);
          extractedDate = new Date(json.extractedAt).toLocaleString();
        }

        return { name: folder.name, extractedDate };
      })
    );

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Extracted Files</title>
        <style>
          body { margin:0; font-family: Arial; background:#f4f6f9; }
          header { background:#004d40; color:white; padding:15px; text-align:center; font-size:1.5em; }
          .menu-btn { position:absolute; left:15px; top:15px; font-size:1.2em; background:#00796b; border:none; color:white; padding:8px 12px; border-radius:4px; cursor:pointer; }
          .sidebar { position:fixed; top:0; left:-220px; width:200px; height:100%; background:#004d40; color:white; padding-top:60px; transition:0.3s; }
          .sidebar.active { left:0; }
          .sidebar a { display:block; color:white; padding:15px; text-decoration:none; }
          .sidebar a:hover { background:#00796b; }
          .content { margin-left:0; padding:20px; transition:0.3s; }
          .content.active { margin-left:200px; }
          table { width:100%; border-collapse:collapse; margin-top:20px; }
          th, td { padding:10px; border:1px solid #ddd; text-align:left; }
          th { background:#00796b; color:white; }
          tr:hover { background:#f1f1f1; }
          .btn { background:#00796b; color:white; padding:6px 12px; border:none; border-radius:4px; cursor:pointer; }
          .btn:hover { background:#004d40; }
          .modal { display:none; position:fixed; z-index:10; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.5); }
          .modal-content { background:white; margin:5% auto; padding:20px; width:80%; max-height:80vh; overflow-y:auto; border-radius:8px; }
          .close { float:right; font-size:1.5em; cursor:pointer; }
          .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }
          .grid img { width:100%; border-radius:6px; cursor:pointer; }
        </style>
      </head>
      <body>
        <header>
          <button class="menu-btn" onclick="toggleSidebar()">☰ Menu</button>
          Extracted Files
        </header>
        <div class="sidebar" id="sidebar">
          <a href="/">Dashboard</a>
          <a href="/extracted">Extracted</a>
          <a href="/done">Completed</a>
          <a href="/logout">Logout</a>
        </div>
        <div class="content" id="content">
          <h2>Extracted Files</h2>
          <table>
            <tr><th>Folder</th><th>Date Extracted</th><th>Action</th></tr>
            ${folderData.map(f => `
              <tr>
                <td>${f.name}</td>
                <td>${f.extractedDate}</td>
                <td><button class="btn" onclick="viewFolder('${f.name}')">View</button></td>
              </tr>
            `).join("")}
          </table>
        </div>

        <div id="viewModal" class="modal">
          <div class="modal-content">
            <span class="close" onclick="closeModal()">&times;</span>
            <h3 id="modalTitle"></h3>
            <div id="modalBody"></div>
            <button class="btn" id="doneBtn">Mark as Done</button>
          </div>
        </div>

        <script>
          function toggleSidebar(){
            document.getElementById("sidebar").classList.toggle("active");
            document.getElementById("content").classList.toggle("active");
          }
          function viewFolder(folder){
            fetch('/extracted/' + folder + '/list')
              .then(r=>r.json())
              .then(data=>{
                document.getElementById("modalTitle").innerText = folder;
                let body="";
                if(data.length){
                  body='<div class="grid">';
                  data.forEach(f=>{
                    if(f.url.match(/.(jpg|jpeg|png|gif)$/i)){
                      body+=\`<img src="\${f.url}" />\`;
                    } else {
                      body+=\`<a href="\${f.url}" target="_blank">\${f.name}</a><br>\`;
                    }
                  });
                  body+='</div>';
                } else { body='<p>No files.</p>'; }
                document.getElementById("modalBody").innerHTML=body;
                document.getElementById("doneBtn").onclick=()=>markDone(folder);
                document.getElementById("viewModal").style.display="block";
              });
          }
          function closeModal(){ document.getElementById("viewModal").style.display="none"; }
          function markDone(folder){
            fetch('/extracted/'+folder+'/done',{method:'POST'}).then(()=>location.reload());
          }
          window.onclick=function(e){ if(e.target==document.getElementById("viewModal")) closeModal(); }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// List files in extracted folder
router.get("/:folder/list", async (req, res) => {
  const folder=req.params.folder;
  const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
  if(error) return res.status(500).json({error:error.message});
  const files = await Promise.all(
    data.filter(f=>!f.name.endsWith(".extracted.json")).map(async f=>{
     const { data } = supabase.storage
  .from(EXTRACTED_BUCKET)
  .getPublicUrl(`${folder}/${f.name}`);
      return { name:f.name, url:url.publicUrl };
    })
  );
  res.json(files);
});

// Mark folder as done
router.post("/:folder/done", async (req,res)=>{
  const folder=req.params.folder;
  const { data: files, error } = await supabase.storage.from(EXTRACTED_BUCKET).list(folder);
  if(error) return res.status(500).send(error.message);

  // Copy files to Completed
  for(const f of files){
    const { data: fileData } = await supabase.storage.from(EXTRACTED_BUCKET).download(\`\${folder}/\${f.name}\`);
    await supabase.storage.from(DONE_BUCKET).upload(\`\${folder}/\${f.name}\`, fileData, { upsert:true });
  }
  // Add completed.json
  await supabase.storage.from(DONE_BUCKET).upload(\`\${folder}/.completed.json\`, JSON.stringify({completedAt:new Date()}), {upsert:true});
  // Remove from Extracted
  for(const f of files){
    await supabase.storage.from(EXTRACTED_BUCKET).remove([\`\${folder}/\${f.name}\`]);
  }
  await supabase.storage.from(EXTRACTED_BUCKET).remove([\`\${folder}/.extracted.json\`]);

  res.send("Moved to completed");
});

export default router;
