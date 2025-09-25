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
   const isAdmin = req.session.user?.role === "admin";
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
      ${isAdmin ? '<option value="accounts">👥 User Accounts</option>' : ''}
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
    const landscape = (type === "accounts" || type === "all");
    const doc = new PDFDocument({ margin: 40, layout: landscape ? "landscape" : "portrait" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="report-${type}.pdf"`);
    doc.pipe(res);

    // 📅 Date (top-right)
    const now = new Date().toLocaleString();
    doc.fontSize(10).fillColor("gray").text(`Date Printed: ${now}`, { align: "right" });

    // Title
    doc.moveDown();
    doc.fontSize(20).fillColor("#004d40").text(`Report: ${type.toUpperCase()}`, { align: "center" });
    doc.moveDown();

    // 📥 Received Files
    if (type === "received" || type === "all") {
      const { data, error } = await supabase.storage.from(RECEIVED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("Received Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // 📂 Extracted Files
    if (type === "extracted" || type === "all") {
      const { data, error } = await supabase.storage.from(EXTRACTED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("Extracted Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // ✅ Completed Files
    if (type === "completed" || type === "all") {
      const { data, error } = await supabase.storage.from(COMPLETED_BUCKET).list();
      if (error) throw error;
      doc.fontSize(14).fillColor("#009688").text("Completed Files");
      doc.moveDown(0.5);
      data.forEach(f => doc.fontSize(12).fillColor("black").text(`- ${f.name}`));
      doc.moveDown();
    }

    // 👥 Accounts
    if (isAdmin && (type === "accounts" || type === "all")) {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username, email, contact_number");
      if (error) throw error;

      doc.fontSize(14).fillColor("#009688").text("User Accounts");
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(12).fillColor("black");
      const startY = doc.y;
      doc.text("ID", 50, startY);
      doc.text("Full Name", 240, startY);
      doc.text("Username", 380, startY);
      doc.text("Email", 480, startY);
      doc.text("Contact", 660, startY);

      // Divider line
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(750, doc.y).stroke();
      doc.moveDown(0.5);

      // Rows
      data.forEach(acc => {
        const y = doc.y;
        doc.text(acc.id, 50, y, { width: 200 });
        doc.text(acc.full_name || "-", 240, y, { width: 150 });
        doc.text(acc.username || "-", 380, y, { width: 120 });
        doc.text(acc.email || "-", 480, y, { width: 180 });
        doc.text(acc.contact_number || "-", 660, y, { width: 700 });
        doc.moveDown();
      });

      doc.moveDown();
    }

// 📌 Footer signatories and footer link
const currentUser = req.session?.user?.full_name || "Unknown User";
const margin = 50; // left/right margin
const signText = "Approved by: ________________________";

function addSignatories(doc) {
  const signY = doc.page.height - 150; // fixed height above footer

  // Printed by (left)
  doc.fontSize(12).fillColor("black").text(`Printed by: ${currentUser}`, margin, signY);

  // Approved by (right)
  const approvedX = doc.page.width - margin - doc.widthOfString(signText);
  doc.text(signText, approvedX, signY);
}

function addFooter(doc) {
  const bottomY = doc.page.height - 30; // bottom margin
  doc.fontSize(10).fillColor("gray").text(
    "https://bottle-scanner.onrender.com",
    margin, // left margin
    bottomY,
    { lineBreak: false }
  );
}

// Add to first page
addSignatories(doc);
addFooter(doc);

// Ensure signatories and footer are added on every new page
doc.on("pageAdded", () => {
  addSignatories(doc);
  addFooter(doc);
});



    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error("Error generating report:", err.message);
    res.status(500).send(`<p style="color:red;">Error generating report: ${err.message}</p>`);
  }
});


export default router;
