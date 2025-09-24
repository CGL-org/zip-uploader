// routes/print.js
import express from "express";

const router = express.Router();

// Print page
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

/* Container */
.container { max-width:800px; margin:80px auto; padding:20px; background:white; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.1); }

/* Form */
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

// Handle generate (for now just preview selected type)
router.post("/generate", express.urlencoded({ extended: true }), (req, res) => {
  const type = req.body.reportType;
  res.send(`
    <html>
    <head><title>Report Preview</title></head>
    <body style="font-family:Arial;padding:20px;">
      <h2>Report Type: ${type}</h2>
      <p>✅ This is a placeholder for the <b>${type}</b> report. 
      Later we will connect it to Supabase and auto-generate the data.</p>
      <button onclick="window.print()">🖨 Print This Page</button>
    </body>
    </html>
  `);
});

export default router;
