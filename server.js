const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'changeme';
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const BRIEFINGS_DIR = path.join(DATA_DIR, 'briefings');

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
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''))
    .sort()
    .reverse();
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

// ---- Briefings API (daily HTML archive) ----
app.get('/api/briefings', (req, res) => {
  res.json({ dates: listBriefings() });
});

app.get('/api/briefings/latest', (req, res) => {
  const dates = listBriefings();
  if (!dates.length) return res.status(404).json({ error: 'none yet' });
  res.sendFile(path.join(BRIEFINGS_DIR, dates[0] + '.html'));
});

app.get('/api/briefings/:date', (req, res) => {
  const file = path.join(BRIEFINGS_DIR, req.params.date + '.html');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  res.sendFile(file);
});

app.post('/api/briefings', requireKey, (req, res) => {
  const { date, html } = req.body || {};
  if (!date || !html) return res.status(400).json({ error: 'date and html required' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  fs.writeFileSync(path.join(BRIEFINGS_DIR, date + '.html'), html, 'utf8');
  res.json({ ok: true, date });
});

// ---- Frontend ----
app.get('/', (req, res) => {
  const dates = listBriefings();
  if (!dates.length) {
    return res.send(renderShell('<p style="padding:40px;font-family:sans-serif;color:#6B6A63;">Nenhuma edição publicada ainda.</p>'));
  }
  res.redirect('/briefing/' + dates[0]);
});

app.get('/briefing/:date', (req, res) => {
  const file = path.join(BRIEFINGS_DIR, req.params.date + '.html');
  if (!fs.existsSync(file)) return res.status(404).send(renderShell('<p style="padding:40px;font-family:sans-serif;">Edição não encontrada.</p>'));
  res.sendFile(file);
});

app.get('/arquivo', (req, res) => {
  const dates = listBriefings();
  const items = dates.map(d => {
    const label = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return `<a href="/briefing/${d}" style="display:block;padding:16px 20px;border-bottom:1px solid #E7E1D4;color:#1C1B18;text-decoration:none;font-family:-apple-system,'Segoe UI',sans-serif;">
      <div style="font-size:15px;font-weight:600;text-transform:capitalize;">${label}</div>
    </a>`;
  }).join('');
  res.send(renderShell(`
    <div style="max-width:640px;margin:0 auto;padding:40px 20px;">
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#0B1E3D;margin-bottom:24px;">Arquivo — Briefing Diário</h1>
      <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E7E1D4;">${items || '<p style="padding:20px;">Nada ainda.</p>'}</div>
    </div>
  `));
});

function renderShell(inner) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Briefing Diário</title><style>body{margin:0;background:#FAF6EF;}</style></head><body>${inner}</body></html>`;
}

app.listen(PORT, () => console.log('Briefing app listening on ' + PORT));
