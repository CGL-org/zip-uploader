// index.js
import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'Receive_Files';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();

// ✅ Helmet with CSP (disallows inline scripts, but allows self-hosted JS)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"], // only allow JS from same server
      },
    },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }
});

// Upload & extract endpoint
app.post('/upload-zip', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file attached (field name = file)' });

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const uploaded = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let raw = entry.entryName.replace(/\\/g, '/');
      const parts = raw.split('/').filter(p => p && p !== '..');
      const safePath = parts.join('/');

      if (!safePath) continue;

      const data = entry.getData();

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(safePath, data, { upsert: true });

      if (upErr) {
        console.error('Supabase upload error for', safePath, upErr);
      } else {
        uploaded.push(safePath);
      }
    }

    res.json({ ok: true, uploaded });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List files
app.get('/files', async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
    if (error) return res.status(500).json({ error: error.message });

    const files = data.map(f => {
      const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
      return { ...f, publicUrl: g?.data?.publicUrl || null };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
