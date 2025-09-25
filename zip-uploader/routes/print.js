// routes/print.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RECEIVED_BUCKET = "Received_Files";
const EXTRACTED_BUCKET = "Extracted_Files";
const COMPLETED_BUCKET = "Completed";

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
    <button type="submit">Generate PDF Report</button>
  </form>
</div>
</body>
</html>
  `);
});

// 📊 Generate PDF reports
router.post("/generate", express.urlencoded({ extended: true }), async (req, res) => {
  const type = req.body.reportType;

  try {
    // Create PDF
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="report-${type}.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).fillColor("#004d40").text(`Report: ${type.toUpperCase()}`, { align: "center" });
    doc.moveDown();

    // 📥 Received Files
    if (type === "received" || type === "all") {
      const { data, error } = await supabase.storage.from(RECEIVED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("📥 Received Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // 📂 Extracted Files
    if (type === "extracted" || type === "all") {
      const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("📂 Extracted Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // ✅ Completed Files
    if (type === "completed" || type === "all") {
      const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("✅ Completed Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // 👥 Accounts
    if (type === "accounts" || type === "all") {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username");
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("👥 User Accounts");
      doc.moveDown(0.5);
      data.forEach(acc => {
        doc.fontSize(12).fillColor("black").text(`ID: ${acc.id} | Name: ${acc.full_name} | Username: ${acc.username}`);
      });
      doc.moveDown();
    }

    // Footer signatory
    doc.moveDown(4);
    const currentUser = req.session?.user?.full_name || "Unknown User";
    doc.fontSize(12).fillColor("black").text(`Printed by: ${currentUser}`, { continued: true });
    doc.text(" ".repeat(40) + "Approved by: ________________________");

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error("Error generating report:", err.message);
    res.status(500).send(`<p style="color:red;">Error generating report: ${err.message}</p>`);
  }
});

export default router;
