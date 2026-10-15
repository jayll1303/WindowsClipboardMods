// Generates the voiceover with the FreeTTS API (https://freetts.org/developers).
// Reads the API key from the FREETTS_API_KEY environment variable, writes one
// MP3 per scene to public/voiceover/<video>-<scene>.mp3 and their durations to
// src/voiceover.json. Scenes that already have audio are skipped unless
// --force is passed, to save the daily character quota.
//
// Usage: node scripts/tts.mjs [--force] [--voice en-US-AriaNeural]

import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';

const API = 'https://freetts.org/api';
const key = process.env.FREETTS_API_KEY;
if (!key) {
  console.error('Set FREETTS_API_KEY first (create a key in the FreeTTS dashboard).');
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const voiceArg = args.indexOf('--voice');
const script = JSON.parse(readFileSync('voiceover/script.json', 'utf8'));
const voice = voiceArg >= 0 ? args[voiceArg + 1] : script.voice;

mkdirSync('public/voiceover', {recursive: true});

const durationOf = (file) => {
  const out = execFileSync(
    'npx',
    ['remotion', 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    {encoding: 'utf8', shell: true},
  );
  return Number.parseFloat(out.trim());
};

const synthesize = async (text, file) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/v1/tts`, {
      method: 'POST',
      headers: {'x-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({text, voice, rate: script.rate, output_format: 'mp3'}),
    });
    if (res.status === 429 && attempt < 5) {
      // Free keys allow about 10 requests a minute.
      await sleep(15000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
    }
    const {file_id: fileId, chars_used: used, chars_limit: limit} = await res.json();
    const audio = await fetch(`${API}/audio/${fileId}`, {headers: {'x-api-key': key}});
    if (!audio.ok) {
      throw new Error(`Audio download failed (${audio.status})`);
    }
    writeFileSync(file, Buffer.from(await audio.arrayBuffer()));
    if (used !== undefined) {
      console.log(`  characters used: ${used}/${limit}`);
    }
    return;
  }
};

const durations = existsSync('src/voiceover.json')
  ? JSON.parse(readFileSync('src/voiceover.json', 'utf8'))
  : {};

for (const video of ['youtube', 'short']) {
  durations[video] ??= {};
  for (const [scene, text] of Object.entries(script[video])) {
    const file = `public/voiceover/${video}-${scene}.mp3`;
    if (force || !existsSync(file)) {
      console.log(`${video}/${scene}: ${text}`);
      await synthesize(text, file);
    }
    durations[video][scene] = Math.round(durationOf(file) * 100) / 100;
    console.log(`${video}/${scene}: ${durations[video][scene]}s`);
  }
}

writeFileSync('src/voiceover.json', JSON.stringify(durations, null, 2) + '\n');
console.log('Wrote src/voiceover.json');
