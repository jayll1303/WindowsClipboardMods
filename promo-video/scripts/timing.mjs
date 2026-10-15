// Scene timing shared by the videos and the music script. Each scene lasts its
// base length from src/scenes.json, or longer if its voiceover needs it.

import {existsSync, readFileSync} from 'node:fs';

// Voiceover starts this far into its scene and leaves this much after it.
export const VOICE_LEAD_IN = 0.4;
export const VOICE_TAIL = 0.8;

export const sceneLength = (baseSeconds, voiceSeconds) =>
  voiceSeconds ? Math.max(baseSeconds, Math.ceil(VOICE_LEAD_IN + voiceSeconds + VOICE_TAIL)) : baseSeconds;

export const totalSeconds = (video) => {
  const scenes = JSON.parse(readFileSync('src/scenes.json', 'utf8'))[video];
  const voice = existsSync('src/voiceover.json')
    ? JSON.parse(readFileSync('src/voiceover.json', 'utf8'))[video] ?? {}
    : {};
  return Object.entries(scenes).reduce((sum, [id, base]) => sum + sceneLength(base, voice[id]), 0);
};
