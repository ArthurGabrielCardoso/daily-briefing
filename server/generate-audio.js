#!/usr/bin/env node
/**
 * Renders narration for one edition, or for every edition that has none.
 *
 *   npm run audio -- 2026-08-06        one edition
 *   npm run audio -- 2026-08-06 --force  redo it
 *   npm run audio -- --all             every edition still missing audio
 *   npm run audio -- --voices          list the pt-BR voices on offer
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAudio, listVoices, readManifest, resolveVoice } from './tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data');
const BRIEFINGS_DIR = path.join(DATA_DIR, 'briefings');

const args = process.argv.slice(2);
const force = args.includes('--force');
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

function allDates() {
  if (!fs.existsSync(BRIEFINGS_DIR)) return [];
  return fs
    .readdirSync(BRIEFINGS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
}

async function main() {
  if (args.includes('--voices')) {
    const voices = await listVoices();
    for (const v of voices) console.log(`${v.name}  ${v.ssmlGender}  ${v.naturalSampleRateHertz}Hz`);
    console.log(`\n${voices.length} vozes pt-BR · escolhida por padrão: ${await resolveVoice()}`);
    return;
  }

  let targets = dates;
  if (args.includes('--all')) {
    targets = allDates().filter((d) => force || !readManifest(DATA_DIR, d));
  }
  if (!targets.length) {
    console.error('uso: npm run audio -- <YYYY-MM-DD> [--force] | --all | --voices');
    process.exitCode = 1;
    return;
  }

  for (const date of targets) {
    const file = path.join(BRIEFINGS_DIR, date + '.json');
    if (!fs.existsSync(file)) {
      console.error(`edição ${date} não encontrada em ${BRIEFINGS_DIR}`);
      process.exitCode = 1;
      continue;
    }
    const briefing = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`\n=== ${date} ===`);
    await generateAudio(DATA_DIR, date, briefing, { force, log: (m) => console.log(m) });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
