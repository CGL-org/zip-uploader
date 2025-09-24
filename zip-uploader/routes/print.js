// routes/print.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RECEIVED_BUCKET = "Received_Files";
const EXTRACTED_BUCKET = "Extracted_Files";
const COMPLETED_BUCKET = "Completed";

function renderLayout(title, content) {
  return `
<html>
<head>
<title>${title}</title>
<style>
body { font-family:'Segoe UI', Roboto, Arial, sans-serif; background:#fff; margin:20px; color:#222; }
h1 { text-align:center; color:#004d40; margin-bottom:20px; }
h2 { color:#009688; margin-top:40px; }
table { width:100%; border-collapse:collapse; margin-top:10px; }
th, td { border:1px solid #ccc; padding:8px; text-align:left; }
th { background:#004d40; color:#fff; }
tr:nth-child(even) { background:#f9f9f9; }
.print-btn { display:block; margin:20px auto; padding:10px 16px; border:none; background:#009688; color:#fff; font-size:1rem; border-radius:6px; cursor:pointer; }
.print-btn:hover { background:#00796b; }
@media print {
  .print-btn { display:none; }
}

.footer-signatory {
  margin-top: 60px;
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
}
.footer-signatory p {
  margin: 0 40px;
}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print This Page</button>
<h1>${title}</h1>
${content}
</body>
</html>
  `;
}

// 📑 Print page (selection)
router.get("/", (req, res) => {
  res.send(`
<html>
<head>
<title>Print Reports</title>
<style>
:root {
  --brand: #004d40;
  --accent: #009688;
  --bg: #f4f6f9;
}
body { margin:0; font-family:'Segoe UI', Roboto, Arial, sans-serif; background:var(--bg); color:#222; }
header { background:var(--brand); color:white; padding:15px; text-align:center; font-size:1.25rem; }
.container { max-width:800px; margin:80px auto; padding:20px; background:white; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.1); }
form { display:flex; flex-direction:column; gap:15px; }
label { font-weight:600; }
select, button {
  padding:10px; border-radius:6px; border:1px solid #ccc; font-size:1em;
}
button {
  background:var(--accent); color:white; border:none; cursor:pointer;
  transition: background .2s;
}
button:hover { background:#00796b; }
</style>
</head>
<body>
<header>🖨 Print Reports</header>
<div class="container">
  <h2>Select Report Type</h2>
  <form action="/print/generate" method="POST" target="_blank">
    <label for="reportType">Choose report:</label>
    <select id="reportType" name="reportType" required>
      <option value="">-- Select a report --</option>
      <option value="received">📥 Received Files</option>
      <option value="extracted">📂 Extracted Files</option>
      <option value="completed">✅ Completed Files</option>
      <option value="accounts">👥 User Accounts</option>
      <option value="all">📊 All Data Reports</option>
    </select>
    <button type="submit">Generate Report</button>
  </form>
</div>
</body>
</html>
  `);
});

// 📊 Generate reports
router.post("/generate", express.urlencoded({ extended: true }), async (req, res) => {
  const type = req.body.reportType;

  try {
    let content = "";

    // 📥 Received Files
    if (type === "received" || type === "all") {
      const { data, error } = await supabase.storage.from(RECEIVED_BUCKET).list();
      if (error) throw error;
      content += `<h2>📥 Received Files</h2><table><tr><th>File/Folder</th></tr>`;
      data.forEach(f => { content += `<tr><td>${f.name}</td></tr>`; });
      content += `</table>`;
    }

    // 📂 Extracted Files
    if (type === "extracted" || type === "all") {
      const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list();
      if (error) throw error;
      content += `<h2>📂 Extracted Files</h2><table><tr><th>File/Folder</th></tr>`;
      data.forEach(f => { content += `<tr><td>${f.name}</td></tr>`; });
      content += `</table>`;
    }

    // ✅ Completed Files
    if (type === "completed" || type === "all") {
      const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list();
      if (error) throw error;
      content += `<h2>✅ Completed Files</h2><table><tr><th>Folder</th></tr>`;
      data.forEach(f => { content += `<tr><td>${f.name}</td></tr>`; });
      content += `</table>`;
    }

    // 👥 Accounts
    if (type === "accounts" || type === "all") {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username");
      if (error) throw error;
      content += `<h2>👥 User Accounts</h2>
      <table>
        <tr><th>ID</th><th>Name</th><th>Username</th></tr>`;
      data.forEach(acc => {
        content += `<tr>
          <td>${acc.id}</td>
          <td>${acc.full_name}</td>
          <td>${acc.username}</td>
        </tr>`;
      });
      content += `</table>`;
    }

    if (!content) content = `<p>No data found for ${type} report.</p>`;

    const currentUser = req.session?.user?.full_name || "Unknown User";

    res.send(renderLayout("Report: " + type, `
      ${content}
      <div class="footer-signatory">
        <p>Printed by: <strong>${currentUser}</strong></p>
        <p>Approved by: ________________________</p>
      </div>
    `));
  } catch (err) {
    console.error("Error generating report:", err.message);
    res.status(500).send(`<p style="color:red;">Error generating report: ${err.message}</p>`);
  }
});

export default router;
