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
        .sidebar {
          position:fixed; top:0; left:-220px; width:200px; height:100%;
          background:#004d40; color:white; padding-top:60px;
          transition:0.3s;
        }
        .sidebar a { display:block; padding:12px; color:white; text-decoration:none; }
        .sidebar a:hover { background:#00796b; }
        #menuArrow {
          position:fixed; top:50%; left:0;
          background:#004d40; color:white; padding:8px;
          border-radius:0 5px 5px 0; cursor:pointer;
          z-index:1000;
        }
        .content { padding:20px; margin-left:20px; }
        table { width:100%; border-collapse:collapse; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        thead { background:#009688; color:white; }
        th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
        tbody tr:nth-child(even) { background:#f9f9f9; }
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
        <h2>Files in Extracted Bucket</h2>
        <table>
          <thead><tr><th>Name</th><th>Last Modified</th><th>Action</th></tr></thead>
          <tbody>
            ${data.map(f => `
              <tr>
                <td>${f.name}</td>
                <td>${f.updated_at || "N/A"}</td>
                <td><a href="/extracted/${f.name}/list">View</a></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <script>
        const menuArrow=document.getElementById("menuArrow");
        const sidebar=document.getElementById("sidebar");
        menuArrow.addEventListener("click",()=> {
          sidebar.classList.toggle("active");
          if(sidebar.classList.contains("active")) {
            sidebar.style.left="0"; menuArrow.style.display="none";
          } else {
            sidebar.style.left="-220px"; menuArrow.style.display="block";
          }
        });
        document.addEventListener("click",(e)=>{
          if(!sidebar.contains(e.target) && !menuArrow.contains(e.target)){
            sidebar.classList.remove("active");
            sidebar.style.left="-220px";
            menuArrow.style.display="block";
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

// List files inside extracted folder
router.get("/:folder/list", async (req, res) => {
  try {
    const folder = req.params.folder;
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

export default router;
