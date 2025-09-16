// index.js  (ESM)
import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // SERVICE key - keep secret
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 } // example: 500MB limit - tune per needs
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

      // normalize & sanitize path to prevent traversal
      let raw = entry.entryName.replace(/\\/g, '/');
      // remove any leading slashes and .. segments
      const parts = raw.split('/').filter(p => p && p !== '..');
      const safePath = parts.join('/');

      if (!safePath) continue;

      const data = entry.getData(); // Buffer

      // Upload to Supabase storage (path = safePath)
      const { data: upData, error: upErr } = await supabase.storage
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

// List files (works best if bucket is public; otherwise create signed URLs)
app.get('/files', async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
    if (error) return res.status(500).json({ error: error.message });

    // build public URLs (only valid if bucket is public)
    const files = data.map(f => {
      const g = supabase.storage.from(BUCKET).getPublicUrl(f.name);
      const publicUrl = g?.data?.publicUrl || null;
      return { ...f, publicUrl };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
