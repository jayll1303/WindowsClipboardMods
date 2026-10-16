// Scene timing for the music script; must match src/timing.ts and src/pace.ts.
// A scene lasts its base length from src/scenes.json played at PACE, or as long
// as its voiceover needs if that's longer.

import {existsSync, readFileSync} from 'node:fs';

const FPS = 30;
const PACE = 1.6;
const VOICE_LEAD_IN = 0.25;
const VOICE_TAIL = 0.45;

const sceneFrames = (baseSeconds, voiceSeconds) =>
  Math.max(
    Math.round((baseSeconds * FPS) / PACE),
    voiceSeconds ? Math.round((VOICE_LEAD_IN + voiceSeconds + VOICE_TAIL) * FPS) : 0,
  );

export const totalSeconds = (video) => {
  const scenes = JSON.parse(readFileSync('src/scenes.json', 'utf8'))[video];
  const voice = existsSync('src/voiceover.json')
    ? JSON.parse(readFileSync('src/voiceover.json', 'utf8'))[video] ?? {}
    : {};
  const frames = Object.entries(scenes).reduce((sum, [id, base]) => sum + sceneFrames(base, voice[id]), 0);
  return frames / FPS;
};
