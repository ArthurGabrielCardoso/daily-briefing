import fs from 'node:fs';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';
import { readBlocksOf } from '../shared/readBlocks.js';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1';

/** Refuse anything wildly larger than a normal edition, so a bad payload
 *  can never burn through the monthly quota. A real edition is ~4k chars. */
const MAX_CHARS = 20000;

/** Chirp 3 HD is Google's generative tier — the reason we are doing this at all. */
const PREFERRED_VOICE_PATTERN = /Chirp3-HD/i;
const LANGUAGE = 'pt-BR';

export class TtsError extends Error {}

function apiKey() {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new TtsError('GOOGLE_TTS_API_KEY não configurada');
  return key;
}

/**
 * Picks the voice at runtime instead of hardcoding a name. Google's catalogue
 * changes and the exact pt-BR Chirp 3 HD names are not stable enough to assume;
 * TTS_VOICE overrides if a specific one is wanted.
 */
export async function resolveVoice() {
  if (process.env.TTS_VOICE) return process.env.TTS_VOICE;

  const res = await fetch(
    `${ENDPOINT}/voices?languageCode=${LANGUAGE}&key=${encodeURIComponent(apiKey())}`
  );
  if (!res.ok) {
    throw new TtsError(`falha ao listar vozes (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const { voices = [] } = await res.json();
  const ptBr = voices.filter((v) => (v.languageCodes || []).includes(LANGUAGE));
  if (!ptBr.length) throw new TtsError(`nenhuma voz ${LANGUAGE} disponível`);

  const chirp = ptBr.filter((v) => PREFERRED_VOICE_PATTERN.test(v.name));
  const pool = chirp.length ? chirp : ptBr;
  // Female voices read the briefing today; keep that if the tier offers a choice.
  const female = pool.filter((v) => v.ssmlGender === 'FEMALE');
  return (female[0] || pool[0]).name;
}

/** Lists every pt-BR voice, for inspection from the CLI. */
export async function listVoices() {
  const res = await fetch(
    `${ENDPOINT}/voices?languageCode=${LANGUAGE}&key=${encodeURIComponent(apiKey())}`
  );
  if (!res.ok) {
    throw new TtsError(`falha ao listar vozes (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const { voices = [] } = await res.json();
  return voices.filter((v) => (v.languageCodes || []).includes(LANGUAGE));
}

async function synthesize(text, voice) {
  const res = await fetch(`${ENDPOINT}/text:synthesize?key=${encodeURIComponent(apiKey())}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: LANGUAGE, name: voice },
      // Chirp 3 HD rejects speakingRate/pitch; playback speed is a client concern.
      audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 },
    }),
  });
  if (!res.ok) {
    throw new TtsError(`síntese falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const { audioContent } = await res.json();
  if (!audioContent) throw new TtsError('resposta sem audioContent');
  return Buffer.from(audioContent, 'base64');
}

/**
 * A real excerpt from the briefing — numbers, foreign names and a natural
 * cadence — so comparing voices reflects how they actually read an edition.
 */
export const SAMPLE_TEXT =
  'Presta atenção nesse número: 19. Foi quantas vezes, em testes controlados, ' +
  'agentes da OpenAI e da Anthropic tentaram fazer algo que ninguém pediu.';

export function samplesDir(dataDir) {
  return path.join(dataDir, 'audio', '_amostras');
}

export function readSamples(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(samplesDir(dataDir), 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Renders the same excerpt in every pt-BR Chirp 3 HD voice, so the voice can be
 * chosen by listening rather than by guessing from a name. Google publishes no
 * readable description of these voices, and the docs are not fetchable, so a
 * side-by-side is the only honest way to pick one.
 */
export async function generateVoiceSamples(dataDir, { force = false, log = () => {} } = {}) {
  const existing = readSamples(dataDir);
  if (existing && !force) {
    log(`amostras já existem (${existing.voices.length} vozes)`);
    return existing;
  }

  const all = await listVoices();
  const pool = all.filter((v) => PREFERRED_VOICE_PATTERN.test(v.name));
  if (!pool.length) throw new TtsError('nenhuma voz Chirp3-HD disponível');

  const dir = samplesDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  log(`gerando ${pool.length} amostras · ${SAMPLE_TEXT.length} caracteres cada`);

  const voices = [];
  for (const v of pool) {
    const short = v.name.replace('pt-BR-Chirp3-HD-', '');
    const file = `${short}.mp3`;
    try {
      const buffer = await synthesize(SAMPLE_TEXT, v.name);
      fs.writeFileSync(path.join(dir, file), buffer);
      const { format } = await parseBuffer(buffer, { mimeType: 'audio/mpeg' });
      voices.push({
        name: v.name,
        short,
        gender: v.ssmlGender === 'FEMALE' ? 'F' : 'M',
        file,
        duration: Number(format.duration) || 0,
      });
    } catch (err) {
      log(`  falhou ${short}: ${err.message}`);
    }
  }

  const manifest = {
    text: SAMPLE_TEXT,
    generatedAt: new Date().toISOString(),
    voices,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`amostras prontas: ${voices.length} vozes`);
  return manifest;
}

export function audioDirFor(dataDir, date) {
  return path.join(dataDir, 'audio', date);
}

export function manifestPathFor(dataDir, date) {
  return path.join(audioDirFor(dataDir, date), 'manifest.json');
}

export function readManifest(dataDir, date) {
  try {
    return JSON.parse(fs.readFileSync(manifestPathFor(dataDir, date), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Renders one MP3 per read block plus a manifest of durations. One file per
 * block gives exact paragraph boundaries without depending on SSML marks,
 * which Chirp 3 HD supports poorly.
 */
export async function generateAudio(dataDir, date, briefing, { force = false, log = () => {} } = {}) {
  const existing = readManifest(dataDir, date);
  if (existing && !force) {
    log(`áudio de ${date} já existe (${existing.blocks.length} blocos) — use force para refazer`);
    return existing;
  }

  const blocks = readBlocksOf(briefing);
  if (!blocks.length) throw new TtsError('edição sem blocos de leitura');

  const totalChars = blocks.reduce((n, s) => n + s.length, 0);
  if (totalChars > MAX_CHARS) {
    throw new TtsError(`edição com ${totalChars} caracteres excede o limite de ${MAX_CHARS}`);
  }

  // Log the whole catalogue: the pt-BR Chirp 3 HD line-up is not documented
  // anywhere we can read, so this is how we find out what there is to choose from.
  try {
    const all = await listVoices();
    const hd = all.filter((v) => PREFERRED_VOICE_PATTERN.test(v.name));
    const fmt = (v) => `${v.name.replace('pt-BR-Chirp3-HD-', '')}(${v.ssmlGender[0]})`;
    log(`vozes pt-BR: ${all.length} no total, ${hd.length} Chirp3-HD`);
    if (hd.length) log(`  Chirp3-HD: ${hd.map(fmt).join(' ')}`);
  } catch {
    /* listing is diagnostics only — never block generation on it */
  }

  const voice = await resolveVoice();
  log(`voz: ${voice} · ${blocks.length} blocos · ${totalChars} caracteres`);

  const dir = audioDirFor(dataDir, date);
  fs.mkdirSync(dir, { recursive: true });

  const entries = [];
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i];
    const buffer = await synthesize(text, voice);
    const file = String(i).padStart(3, '0') + '.mp3';
    fs.writeFileSync(path.join(dir, file), buffer);

    const { format } = await parseBuffer(buffer, { mimeType: 'audio/mpeg' });
    const duration = Number(format.duration) || 0;
    entries.push({ index: i, file, chars: text.length, duration });
    log(`  [${i + 1}/${blocks.length}] ${file} · ${text.length} chars · ${duration.toFixed(1)}s`);
  }

  const manifest = {
    date,
    voice,
    generatedAt: new Date().toISOString(),
    totalChars,
    totalDuration: entries.reduce((n, e) => n + e.duration, 0),
    blocks: entries,
  };

  // Written last, so a half-finished run never looks complete.
  fs.writeFileSync(manifestPathFor(dataDir, date), JSON.stringify(manifest, null, 2));
  log(`pronto: ${manifest.totalDuration.toFixed(1)}s de áudio`);
  return manifest;
}
