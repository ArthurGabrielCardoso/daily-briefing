import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'changeme';
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const BRIEFINGS_DIR = path.join(DATA_DIR, 'briefings');
const DIST_DIR = path.join(__dirname, 'dist');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BRIEFINGS_DIR)) fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '[]');

app.use(express.json({ limit: '5mb' }));

function requireKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function readNotes() {
  try { return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8')); } catch { return []; }
}
function writeNotes(notes) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}
function listBriefings() {
  if (!fs.existsSync(BRIEFINGS_DIR)) return [];
  return fs.readdirSync(BRIEFINGS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort()
    .reverse();
}
function briefingFile(date) {
  return path.join(BRIEFINGS_DIR, date + '.json');
}

// ---- Notes API (persistent memory for personalization) ----
app.get('/api/notes', (req, res) => {
  res.json(readNotes());
});

app.post('/api/notes', requireKey, (req, res) => {
  const { text, tags } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const notes = readNotes();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    tags: Array.isArray(tags) ? tags : [],
    date: new Date().toISOString()
  };
  notes.unshift(note);
  writeNotes(notes.slice(0, 500)); // cap history
  res.json({ ok: true, note });
});

app.delete('/api/notes/:id', requireKey, (req, res) => {
  const notes = readNotes().filter(n => n.id !== req.params.id);
  writeNotes(notes);
  res.json({ ok: true });
});

// ---- Briefings API (daily JSON archive) ----
app.get('/api/briefings', (req, res) => {
  res.json({ dates: listBriefings() });
});

app.get('/api/briefings/latest', (req, res) => {
  const dates = listBriefings();
  if (!dates.length) return res.status(404).json({ error: 'none yet' });
  res.sendFile(briefingFile(dates[0]));
});

app.get('/api/briefings/:date', (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const file = briefingFile(req.params.date);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  res.sendFile(file);
});

app.post('/api/briefings', requireKey, (req, res) => {
  const { date, content } = req.body || {};
  if (!date || !content) return res.status(400).json({ error: 'date and content required' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  if (typeof content !== 'object' || Array.isArray(content)) return res.status(400).json({ error: 'content must be a briefing object' });
  fs.writeFileSync(briefingFile(date), JSON.stringify(content, null, 2), 'utf8');
  res.json({ ok: true, date });
});

// Unknown API routes must not fall through to the SPA shell.
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// ---- Frontend (Vite build) ----
app.use(express.static(DIST_DIR));

app.get('*', (req, res) => {
  const shell = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(shell)) {
    return res
      .status(503)
      .send('<p style="padding:40px;font-family:sans-serif;color:#5B5850;">Build ausente — rode <code>npm run build</code>.</p>');
  }
  res.sendFile(shell);
});

app.listen(PORT, () => console.log('Briefing app listening on ' + PORT));
