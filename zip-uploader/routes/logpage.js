// routes/logpage.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("operation_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).send("Error loading logs");

  const rows = data.map(
    log => `
      <tr>
        <td>${log.username}</td>
        <td>${log.role}</td>
        <td>${log.action}</td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
      </tr>`
  ).join("");

  res.send(`
    <html>
    <head>
      <title>Operation Logs</title>
      <style>
        body { font-family:Arial; background:#f4f6f9; margin:0; }
        header { background:#004d40; color:white; padding:15px; font-size:1.25rem; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th, td { border:1px solid #ddd; padding:8px; text-align:left; }
        th { background:#009688; color:white; }
        tr:nth-child(even){ background:#f9f9f9; }
      </style>
    </head>
    <body>
      <header>📜 Operation Logs</header>
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
