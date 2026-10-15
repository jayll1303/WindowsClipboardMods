// Prints the RMS and peak level of a 16-bit stereo WAV, per window, to check a
// mix without listening to it. Usage: node scripts/wav-levels.mjs <file> [seconds]
import {readFileSync} from 'node:fs';

const [file, windowArg] = process.argv.slice(2);
const windowSeconds = Number(windowArg ?? 2);
const buf = readFileSync(file);
const rate = buf.readUInt32LE(24);
const dataStart = 44;
const frames = (buf.length - dataStart) / 4;
const per = Math.round(windowSeconds * rate);
const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
let clipped = 0;
for (let w = 0; w * per < frames; w++) {
  let sum = 0;
  let peak = 0;
  const end = Math.min(frames, (w + 1) * per);
  for (let i = w * per; i < end; i++) {
    for (const c of [0, 2]) {
      const v = buf.readInt16LE(dataStart + i * 4 + c) / 32768;
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
      if (Math.abs(v) > 0.999) clipped++;
    }
  }
  const rms = Math.sqrt(sum / ((end - w * per) * 2));
  const bar = '#'.repeat(Math.max(0, Math.round((Number(db(rms)) + 40) / 1.5)));
  console.log(`${(w * windowSeconds).toFixed(0).padStart(4)}s  rms ${db(rms).padStart(6)} dB  peak ${db(peak).padStart(6)} dB  ${bar}`);
}
console.log(`clipped samples: ${clipped}`);
