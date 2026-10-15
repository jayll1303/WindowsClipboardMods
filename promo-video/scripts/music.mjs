// Composes the background music in code, so it's original and free to use.
// Upbeat synth-pop over an Am - F - C - G loop: four-on-the-floor kick, claps,
// off-beat hats, a pumping bass, a plucked arpeggio, pads and a short lead hook.
//
// Usage: node scripts/music.mjs <youtube|short>
// Writes public/music/<video>.wav, as long as the video (scene lengths include
// the voiceover, so run scripts/tts.mjs first). The Short starts with the
// drums right away, to hook at once.

import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {totalSeconds} from './timing.mjs';

const video = process.argv[2];
if (video !== 'youtube' && video !== 'short') {
  console.error('Usage: node scripts/music.mjs <youtube|short>');
  process.exit(1);
}
const seconds = totalSeconds(video);
const outFile = `public/music/${video}.wav`;
const short = video === 'short';

const RATE = 44100;
const BPM = 118;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const total = Math.ceil(seconds * RATE);
const left = new Float32Array(total);
const right = new Float32Array(total);

// Seeded noise, so every render is identical.
let seed = 1337;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);
const NOTES = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const note = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  return 12 * (Number(m[3]) + 1) + NOTES[m[1]] + (m[2] ? 1 : 0);
};

const add = (start, samples, pan = 0) => {
  const i0 = Math.round(start * RATE);
  const l = Math.cos(((pan + 1) * Math.PI) / 4);
  const r = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const j = i0 + i;
    if (j >= total) break;
    left[j] += samples[i] * l;
    right[j] += samples[i] * r;
  }
};

// One-pole lowpass applied in place.
const lowpass = (buf, cutoff) => {
  const a = Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y = (1 - a) * buf[i] + a * y;
    buf[i] = y;
  }
  return buf;
};

const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5));
const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);

// ---- Instruments ----

const kick = () => {
  const n = Math.round(0.35 * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const freq = 48 + 110 * Math.exp(-t * 28);
    phase += freq / RATE;
    out[i] = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 7) * 0.95;
    if (i < 80) out[i] += noise() * 0.25 * (1 - i / 80);
  }
  return out;
};

const clap = () => {
  const n = Math.round(0.25 * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // A few quick bursts, then a tail.
    const bursts = t < 0.03 ? Math.exp(-((t * 1000) % 10) / 3) : Math.exp(-(t - 0.03) * 22);
    out[i] = noise() * bursts * 0.5;
  }
  // Crude band-pass: lowpass minus a darker lowpass.
  const low = lowpass(Float32Array.from(out), 400);
  lowpass(out, 5000);
  for (let i = 0; i < n; i++) out[i] -= low[i];
  return out;
};

const hat = (open) => {
  const n = Math.round((open ? 0.18 : 0.05) * RATE);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const x = noise();
    out[i] = (x - prev) * Math.exp(-t * (open ? 18 : 70)) * 0.22;
    prev = x;
  }
  return out;
};

const bass = (midi, length) => {
  const n = Math.round(length * RATE);
  const out = new Float32Array(n);
  const f = midiHz(midi);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += f / RATE;
    const env = Math.min(1, t * 200) * Math.exp(-t * 3) * Math.min(1, (length - t) * 60);
    out[i] = (saw(phase) * 0.6 + Math.sin(2 * Math.PI * phase) * 0.6) * env * 0.42;
  }
  return lowpass(out, 900);
};

const pluck = (midi, length, bright = 1) => {
  const n = Math.round(length * RATE);
  const out = new Float32Array(n);
  const f = midiHz(midi);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    p1 += f / RATE;
    p2 += (f * 1.005) / RATE;
    const env = Math.min(1, t * 400) * Math.exp(-t * 9);
    out[i] = (square(p1) * 0.5 + saw(p2) * 0.5) * env * 0.16;
  }
  return lowpass(out, 1800 + 2600 * bright);
};

const pad = (names, length) => {
  const midis = names.map(note);
  const n = Math.round(length * RATE);
  const out = new Float32Array(n);
  const phases = midis.flatMap(() => [0, 0]);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t * 3) * Math.min(1, (length - t) * 4);
    let s = 0;
    midis.forEach((m, k) => {
      const f = midiHz(m);
      phases[2 * k] += (f * 0.997) / RATE;
      phases[2 * k + 1] += (f * 1.003) / RATE;
      s += saw(phases[2 * k]) + saw(phases[2 * k + 1]);
    });
    out[i] = (s / (midis.length * 2)) * env * 0.11;
  }
  return lowpass(out, 1400);
};

const lead = (midi, length) => {
  const n = Math.round(length * RATE);
  const out = new Float32Array(n);
  const f = midiHz(midi);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 4);
    phase += (f * vibrato) / RATE;
    const env = Math.min(1, t * 120) * (0.75 + 0.25 * Math.exp(-t * 6)) * Math.min(1, (length - t) * 40);
    out[i] = (square(phase) * 0.45 + saw(phase * 2) * 0.2) * env * 0.12;
  }
  return lowpass(out, 3200);
};

// ---- Score ----

const chords = [
  {root: 'A1', tones: ['A3', 'C4', 'E4']},
  {root: 'F1', tones: ['F3', 'A3', 'C4']},
  {root: 'C2', tones: ['G3', 'C4', 'E4']},
  {root: 'G1', tones: ['G3', 'B3', 'D4']},
];

// Eight eighth notes per bar; null is a rest. Two-bar call and answer.
const hook = [
  ['A4', 'C5', 'E5', 'C5', 'D5', 'E5', null, 'G5'],
  ['F5', 'E5', 'C5', 'A4', 'C5', null, null, null],
  ['G4', 'C5', 'E5', 'G5', 'E5', 'D5', 'C5', null],
  ['D5', null, 'B4', null, 'G4', 'A4', 'B4', 'D5'],
];

const bars = Math.ceil(seconds / BAR);
const introBars = short ? 0 : 4;
const outroStart = bars - 2;

for (let b = 0; b < bars; b++) {
  const start = b * BAR;
  const chord = chords[b % 4];
  const intro = b < introBars;
  const outro = b >= outroStart;
  // Every fourth 8-bar block drops the drums for a breather.
  const breakdown = !short && b >= introBars + 16 && Math.floor((b - introBars) / 8) % 4 === 2;
  const drums = !intro && !breakdown && !outro;

  add(start, pad(chord.tones, BAR * (outro ? 2 : 1)), 0);

  // Plucked arpeggio, brighter once the groove is in.
  const arp = [0, 1, 2, 1, 0, 2, 1, 2];
  for (let s = 0; s < 8; s++) {
    if (outro && b === bars - 1) break;
    const m = note(chord.tones[arp[s]]) + 12;
    add(start + s * (BEAT / 2), pluck(m, BEAT * 0.9, intro ? (b + 1) / (introBars + 1) : 1), s % 2 ? 0.35 : -0.35);
  }

  if (!intro || b === introBars - 1) {
    for (let beat = 0; beat < 4; beat++) {
      const t = start + beat * BEAT;
      if (drums || (intro && beat >= 2)) {
        add(t, kick());
      }
      if (drums && beat % 2 === 1) add(t, clap(), 0.1);
      if (drums) {
        add(t + BEAT / 2, hat(beat === 3), 0.3);
        add(t, hat(false), -0.2);
      }
      // Pumping bass on the off-beats.
      if (!intro && !outro) {
        add(t + BEAT / 2, bass(note(chord.root) + 12, BEAT / 2 - 0.01), 0);
        if (beat === 0) add(t, bass(note(chord.root), BEAT / 2 - 0.01), 0);
      }
    }
  }

  // Lead hook in the first block after the intro, then every other block.
  const block = Math.floor((b - introBars) / 8);
  if (!intro && !outro && !breakdown && block % 2 === 0) {
    hook[b % 4].forEach((n, s) => {
      if (n) add(start + s * (BEAT / 2), lead(note(n), BEAT / 2 - 0.02), 0.05);
    });
  }
}

// Final hit on the tonic.
add(outroStart * BAR, kick());
add(outroStart * BAR, pad(['A3', 'C4', 'E4', 'A4'], BAR * 2));

// ---- Master: sidechain-ish pump, soft clip, fades ----

const fadeIn = 0.4;
const fadeOut = 2.5;
let peak = 0;
for (let i = 0; i < total; i++) {
  const t = i / RATE;
  const beatPos = (t % BEAT) / BEAT;
  const pump = 0.72 + 0.28 * Math.min(1, beatPos * 4);
  const fade = Math.min(1, t / fadeIn) * Math.min(1, (seconds - t) / fadeOut);
  left[i] = Math.tanh(left[i] * 1.3 * pump) * fade;
  right[i] = Math.tanh(right[i] * 1.3 * pump) * fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}

const gain = 0.89 / peak;
const data = Buffer.alloc(44 + total * 4);
data.write('RIFF', 0);
data.writeUInt32LE(36 + total * 4, 4);
data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(RATE, 24);
data.writeUInt32LE(RATE * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(total * 4, 40);
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(left[i] * gain * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(right[i] * gain * 32767), 46 + i * 4);
}
mkdirSync(dirname(outFile), {recursive: true});
writeFileSync(outFile, data);
console.log(`Wrote ${outFile}: ${seconds}s, ${bars} bars at ${BPM} BPM`);
