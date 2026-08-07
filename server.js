import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAudio, generateVoiceSamples, readManifest, readSamples } from './server/tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'changeme';
// Points at the Railway volume in production; falls back to the repo dir locally.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const BRIEFINGS_DIR = path.join(DATA_DIR, 'briefings');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const DIST_DIR = path.join(__dirname, 'dist');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BRIEFINGS_DIR)) fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '[]');

// A mounted volume shadows whatever the image shipped in DATA_DIR, so the
// editions committed to the repo have to be copied in on first boot.
function seedBriefings() {
  const from = path.join(SEED_DIR, 'briefings');
  if (!fs.existsSync(from)) return;
  for (const file of fs.readdirSync(from).filter((f) => f.endsWith('.json'))) {
    const target = path.join(BRIEFINGS_DIR, file);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(path.join(from, file), target);
      console.log('seed: copiada edição ' + file);
    }
  }
}
seedBriefings();

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

  // Narration is rendered in the background: publishing must succeed even when
  // TTS is misconfigured or down, and the player falls back to the browser voice.
  const audio = process.env.GOOGLE_TTS_API_KEY ? 'gerando' : 'sem chave de TTS';
  if (process.env.GOOGLE_TTS_API_KEY) {
    generateAudio(DATA_DIR, date, content, { log: (m) => console.log(`[tts ${date}] ${m}`) })
      .catch((err) => console.error(`[tts ${date}] falhou: ${err.message}`));
  }
  res.json({ ok: true, date, audio });
});

// ---- Narration audio ----
app.get('/api/briefings/:date/audio', (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const manifest = readManifest(DATA_DIR, req.params.date);
  if (!manifest) return res.status(404).json({ error: 'no audio' });
  res.json(manifest);
});

app.post('/api/briefings/:date/audio', requireKey, async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const file = briefingFile(date);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  try {
    const briefing = JSON.parse(fs.readFileSync(file, 'utf8'));
    const manifest = await generateAudio(DATA_DIR, date, briefing, {
      force: req.query.force === '1',
      log: (m) => console.log(`[tts ${date}] ${m}`),
    });
    res.json({ ok: true, manifest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Voice samples (for choosing the narration voice by ear) ----
app.get('/api/voices', (req, res) => {
  const samples = readSamples(DATA_DIR);
  if (!samples) return res.status(404).json({ error: 'no samples' });
  res.json({ ...samples, current: process.env.TTS_VOICE || null });
});

app.post('/api/voices/samples', requireKey, async (req, res) => {
  try {
    const manifest = await generateVoiceSamples(DATA_DIR, {
      force: req.query.force === '1',
      log: (m) => console.log(`[tts amostras] ${m}`),
    });
    res.json({ ok: true, voices: manifest.voices.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unknown API routes must not fall through to the SPA shell.
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// Generated narration lives on the data volume, not in the build output.
app.use('/audio', express.static(AUDIO_DIR, { maxAge: '30d', immutable: true }));

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

/**
 * Renders the newest edition's narration on boot when it is missing.
 *
 * Without a mounted volume the audio directory is wiped on every deploy, so
 * self-healing here is what keeps narration available at all. Deliberately
 * limited to the single newest edition — that bounds a boot at ~4k characters,
 * so even frequent deploys stay far inside the monthly free quota.
 */
function generateMissingAudio() {
  if (!process.env.GOOGLE_TTS_API_KEY) {
    console.log('tts: GOOGLE_TTS_API_KEY ausente — narração usa a voz do navegador');
    return;
  }
  const [latest] = listBriefings();
  if (!latest) return;
  if (readManifest(DATA_DIR, latest)) {
    console.log(`tts: ${latest} já tem narração`);
    return;
  }
  console.log(`tts: gerando narração de ${latest}…`);
  const briefing = JSON.parse(fs.readFileSync(briefingFile(latest), 'utf8'));
  generateAudio(DATA_DIR, latest, briefing, { log: (m) => console.log(`[tts ${latest}] ${m}`) })
    .catch((err) => console.error(`[tts ${latest}] falhou: ${err.message}`));
}

/**
 * Opt-in via TTS_SAMPLES=1, because rendering all 30 voices costs ~4k characters
 * and is only worth doing while a voice is being chosen — not on every boot.
 */
function generateSamplesIfAsked() {
  if (process.env.TTS_SAMPLES !== '1' || !process.env.GOOGLE_TTS_API_KEY) return;
  generateVoiceSamples(DATA_DIR, { log: (m) => console.log(`[tts amostras] ${m}`) })
    .catch((err) => console.error(`[tts amostras] falhou: ${err.message}`));
}

app.listen(PORT, () => {
  console.log('Briefing app listening on ' + PORT);
  generateMissingAudio();
  generateSamplesIfAsked();
});
