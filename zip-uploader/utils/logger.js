// utils/logger.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function logAction(req, action) {
  try {
    const username = req.session?.user?.full_name || "Unknown User";
    const role = req.session?.user?.role || "N/A";

    const nowPH = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");

    
    await supabase.from("operation_logs").insert([
      {
        action,
        username,
        role,
         created_at: nowPH
      }
    ]);
  } catch (err) {
    console.error("Log error:", err.message);
  }
}
