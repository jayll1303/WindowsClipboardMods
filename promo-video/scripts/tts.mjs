// Generates the voiceover locally with Kokoro-82M (Apache-2.0) through
// kokoro-js. The first run downloads the model from Hugging Face. Writes one WAV
// per scene to public/voiceover/<video>-<scene>.wav and their durations to
// src/voiceover.json. Scenes that already have audio are skipped unless
// --force is passed.
//
// Usage: node scripts/tts.mjs [--force] [--voice am_adam]

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {KokoroTTS} from 'kokoro-js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const voiceArg = args.indexOf('--voice');
const script = JSON.parse(readFileSync('voiceover/script.json', 'utf8'));
const voice = voiceArg >= 0 ? args[voiceArg + 1] : script.voice;

mkdirSync('public/voiceover', {recursive: true});

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'fp32',
  device: 'cpu',
});

// Reads a 16-bit or float WAV header for its duration.
const wavSeconds = (file) => {
  const buf = readFileSync(file);
  const rate = buf.readUInt32LE(24);
  const bytesPerSecond = buf.readUInt32LE(28);
  let offset = 12;
  while (offset < buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') return size / bytesPerSecond;
    offset += 8 + size;
  }
  throw new Error(`No data chunk in ${file} (${rate} Hz)`);
};

const durations = existsSync('src/voiceover.json')
  ? JSON.parse(readFileSync('src/voiceover.json', 'utf8'))
  : {};

for (const video of ['youtube', 'short']) {
  durations[video] ??= {};
  for (const [scene, text] of Object.entries(script[video])) {
    const file = `public/voiceover/${video}-${scene}.wav`;
    if (force || !existsSync(file)) {
      console.log(`${video}/${scene}: ${text}`);
      const audio = await tts.generate(text, {voice, speed: script.speed});
      // Kokoro speaks quietly; bring every clip to the same peak so the voice
      // sits above the music.
      const samples = audio.audio;
      const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
      if (peak > 0) {
        for (let i = 0; i < samples.length; i++) samples[i] *= 0.89 / peak;
      }
      await audio.save(file);
    }
    durations[video][scene] = Math.round(wavSeconds(file) * 100) / 100;
    console.log(`${video}/${scene}: ${durations[video][scene]}s`);
  }
}

writeFileSync('src/voiceover.json', JSON.stringify(durations, null, 2) + '\n');
console.log('Wrote src/voiceover.json');
