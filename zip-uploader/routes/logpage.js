// routes/logpage.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- MAIN PAGE ----------------
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("operation_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).send("Error loading logs");

  const rows = data
    .map(
      (log) => `
      <tr>
        <td>${log.username}</td>
        <td>${log.role}</td>
        <td>${log.action}</td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
      </tr>`
    )
    .join("");

  res.send(`
    <html>
    <head>
      <title>Operation Logs</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f4f6f9; margin:0; }
        header { background:#004d40; color:white; padding:15px; font-size:1.5rem; text-align:center; }
        
        .filter-container {
          margin: 20px;
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        select, input, button {
          padding: 8px 12px;
          font-size: 1rem;
          border: 1px solid #ccc;
          border-radius: 6px;
        }
        input { width: 250px; }
        button { background:#009688; color:white; cursor:pointer; }
        button:hover { background:#00796b; }

        table { width: 95%; margin: 20px auto; border-collapse: collapse; background:white; border-radius: 10px; overflow:hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        th, td { padding: 12px 15px; text-align:left; }
        th { background:#009688; color:white; font-weight:600; }
        tr:nth-child(even) { background:#f9f9f9; }
        tr:hover { background:#e0f7fa; }
      </style>
    </head>
    <body>
      <header>📜 Operation Logs</header>

      <div class="filter-container">
        <select id="filterColumn">
          <option value="username">User</option>
          <option value="role">Role</option>
          <option value="action">Action</option>
          <option value="created_at">Date/Time</option>
        </select>
        <input type="text" id="searchInput" placeholder="Search...">
        <button id="printBtn">🖨 Print Logs</button>
      </div>

      <table id="logsTable">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
            <th>Date/Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <script>
        const searchInput = document.getElementById("searchInput");
        const filterColumn = document.getElementById("filterColumn");
        const table = document.getElementById("logsTable");
        const rows = table.getElementsByTagName("tr");

        // Live filtering (frontend only for display)
        searchInput.addEventListener("keyup", function() {
          const filter = searchInput.value.toLowerCase();
          const colIndex = filterColumn.selectedIndex;
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName("td");
            if (!cells[colIndex]) continue;
            const textValue = cells[colIndex].textContent || cells[colIndex].innerText;
            rows[i].style.display = textValue.toLowerCase().includes(filter) ? "" : "none";
          }
        });

// Print button → open new route with filters
document.getElementById("printBtn").addEventListener("click", () => {
  const column = filterColumn.value;
  const query = searchInput.value;
  window.open(`/logpage/print-logs?column=${column}&query=${encodeURIComponent(query)}`, "_blank");
});

      </script>
    </body>
    </html>
  `);
});

// ---------------- PRINT PAGE ----------------
router.get("/print-logs", async (req, res) => {
  const { column, query } = req.query;

  let supabaseQuery = supabase
    .from("operation_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (query && column) {
    supabaseQuery = supabaseQuery.ilike(column, `%${query}%`);
  }
  const { data, error } = await supabaseQuery;
  if (error) return res.status(500).send("Error fetching logs");

  const rows = data
    .map(
      (log) => `
      <tr>
        <td>${log.username}</td>
        <td>${log.role}</td>
        <td>${log.action}</td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
      </tr>`
    )
    .join("");

  res.send(`
    <html>
    <head>
      <title>Print Logs</title>
      <style>
        body { font-family: Arial, sans-serif; margin:20px; }
        h2 { text-align:center; }
        table { width:100%; border-collapse: collapse; margin-top:20px; }
        th, td { border:1px solid #444; padding:8px; text-align:left; }
        th { background:#ddd; }
      </style>
    </head>
    <body onload="window.print()">
      <h2>Operation Logs</h2>
      <table>
        <thead>
          <tr><th>User</th><th>Role</th><th>Action</th><th>Date/Time</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
});

export default router;
