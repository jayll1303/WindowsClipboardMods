// Masters a rendered video's audio to YouTube's loudness (-14 LUFS) and puts
// it back into the video without re-encoding the picture. Remotion's bundled
// ffmpeg has no loudness filters, so the processing happens here: a gentle
// compressor, gain to the target, then a look-ahead limiter at -1 dBFS.
// Loudness is measured per ITU-R BS.1770 (K-weighting, gating).
//
// Usage: node scripts/master.mjs <raw.mp4> <out.mp4>

import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/master.mjs <raw.mp4> <out.mp4>');
  process.exit(1);
}

const TARGET_LUFS = -14;
const CEILING_DB = -1;
const RATE = 48000;

// The ffmpeg build that ships with Remotion's compositor for this platform.
const require = createRequire(import.meta.url);
const ffmpegPath = join(
  dirname(require.resolve(`@remotion/compositor-${process.platform}-${process.arch}-msvc/package.json`)),
  'ffmpeg.exe',
);
const ffmpeg = (args) => execFileSync(ffmpegPath, ['-v', 'error', '-y', ...args], {stdio: 'inherit'});

const dir = mkdtempSync(join(tmpdir(), 'master-'));
const rawWav = join(dir, 'raw.wav');
const masteredWav = join(dir, 'mastered.wav');

ffmpeg(['-i', input, '-vn', '-ac', '2', '-ar', String(RATE), '-c:a', 'pcm_s16le', rawWav]);

// ---- WAV in/out ----

const readWav = (file) => {
  const buf = readFileSync(file);
  let offset = 12;
  while (offset < buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    offset += 8;
    if (id === 'data') {
      const frames = Math.floor(Math.min(size, buf.length - offset) / 4);
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        left[i] = buf.readInt16LE(offset + i * 4) / 32768;
        right[i] = buf.readInt16LE(offset + i * 4 + 2) / 32768;
      }
      return [left, right];
    }
    offset += size;
  }
  throw new Error(`No audio data in ${file}`);
};

const writeWav = (file, [left, right]) => {
  const frames = left.length;
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + frames * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(frames * 4, 40);
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < frames; i++) {
    buf.writeInt16LE(clamp(left[i]), 44 + i * 4);
    buf.writeInt16LE(clamp(right[i]), 46 + i * 4);
  }
  writeFileSync(file, buf);
};

// ---- Loudness (BS.1770) ----

const biquad = (x, [b0, b1, b2], [, a1, a2]) => {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
};

// K-weighting coefficients for 48 kHz.
const kWeight = (x) =>
  biquad(
    biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
    [1, -2, 1],
    [1, -1.99004745483398, 0.99007225036621],
  );

const integratedLoudness = ([left, right]) => {
  const l = kWeight(left);
  const r = kWeight(right);
  const block = Math.round(0.4 * RATE);
  const hop = Math.round(0.1 * RATE);
  const powers = [];
  for (let start = 0; start + block <= l.length; start += hop) {
    let sum = 0;
    for (let i = start; i < start + block; i++) sum += l[i] * l[i] + r[i] * r[i];
    powers.push(sum / block);
  }
  const lufs = (p) => -0.691 + 10 * Math.log10(p);
  const absGated = powers.filter((p) => lufs(p) > -70);
  const mean = (ps) => ps.reduce((a, b) => a + b, 0) / ps.length;
  const relGate = lufs(mean(absGated)) - 10;
  return lufs(mean(absGated.filter((p) => lufs(p) > relGate)));
};

const peakDb = ([left, right]) => {
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  return 20 * Math.log10(peak);
};

// ---- Dynamics ----

const dbToGain = (db) => 10 ** (db / 20);

// Linked-stereo feed-forward compressor.
const compress = ([left, right], {thresholdDb = -20, ratio = 3, attack = 0.01, release = 0.15} = {}) => {
  const a = Math.exp(-1 / (attack * RATE));
  const r = Math.exp(-1 / (release * RATE));
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  let env = 0;
  for (let i = 0; i < left.length; i++) {
    const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    env = level > env ? a * env + (1 - a) * level : r * env + (1 - r) * level;
    const levelDb = 20 * Math.log10(env + 1e-9);
    const over = levelDb - thresholdDb;
    const gain = over > 0 ? dbToGain(-over * (1 - 1 / ratio)) : 1;
    outL[i] = left[i] * gain;
    outR[i] = right[i] * gain;
  }
  return [outL, outR];
};

// Look-ahead brickwall limiter: the gain reaches its target before a peak
// arrives, then recovers slowly.
const limit = ([left, right], ceilingDb, lookahead = 0.005, release = 0.08) => {
  const ceiling = dbToGain(ceilingDb);
  const n = left.length;
  const ahead = Math.round(lookahead * RATE);
  const needed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    needed[i] = level > ceiling ? ceiling / level : 1;
  }
  // Minimum gain over the look-ahead window (sliding minimum).
  const windowMin = new Float32Array(n);
  const deque = [];
  for (let i = 0; i < n + ahead; i++) {
    if (i < n) {
      while (deque.length && needed[deque[deque.length - 1]] >= needed[i]) deque.pop();
      deque.push(i);
    }
    const out = i - ahead;
    if (out >= 0) {
      while (deque[0] < out) deque.shift();
      windowMin[out] = deque.length ? needed[deque[0]] : 1;
    }
  }
  const r = Math.exp(-1 / (release * RATE));
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  let gain = 1;
  for (let i = 0; i < n; i++) {
    gain = windowMin[i] < gain ? windowMin[i] : r * gain + (1 - r) * windowMin[i];
    outL[i] = Math.max(-ceiling, Math.min(ceiling, left[i] * gain));
    outR[i] = Math.max(-ceiling, Math.min(ceiling, right[i] * gain));
  }
  return [outL, outR];
};

const scale = ([left, right], g) => [left.map((v) => v * g), right.map((v) => v * g)];

// ---- Master ----

const raw = readWav(rawWav);
console.log(`input:  ${integratedLoudness(raw).toFixed(1)} LUFS, peak ${peakDb(raw).toFixed(1)} dBFS`);

const compressed = compress(raw);
let gainDb = TARGET_LUFS - integratedLoudness(compressed);
let mastered;
// The limiter takes a little loudness back; correct for it.
for (let pass = 0; pass < 3; pass++) {
  mastered = limit(scale(compressed, dbToGain(gainDb)), CEILING_DB);
  const off = TARGET_LUFS - integratedLoudness(mastered);
  if (Math.abs(off) < 0.3) break;
  gainDb += off;
}
console.log(`output: ${integratedLoudness(mastered).toFixed(1)} LUFS, peak ${peakDb(mastered).toFixed(1)} dBFS`);

writeWav(masteredWav, mastered);
ffmpeg([
  '-i', input, '-i', masteredWav,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
  output,
]);
rmSync(dir, {recursive: true, force: true});
console.log(`Wrote ${output}`);
