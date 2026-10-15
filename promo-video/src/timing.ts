import scenes from './scenes.json';
import voiceover from './voiceover.json';
import {FPS} from './theme';

// Must match scripts/timing.mjs, which sizes the music to the same total.
export const VOICE_LEAD_IN = 0.4;
const VOICE_TAIL = 0.8;

export type Video = keyof typeof scenes;

export type SceneTiming = {
  id: string;
  from: number;
  frames: number;
  // Seconds of voiceover, if this scene has one.
  voice: number | null;
};

export const sceneTimings = (video: Video): SceneTiming[] => {
  const voice = ((voiceover as Record<string, Record<string, number>>)[video] ?? {}) as Record<
    string,
    number
  >;
  let from = 0;
  return Object.entries(scenes[video]).map(([id, base]) => {
    const v = voice[id] ?? null;
    const seconds = v ? Math.max(base, Math.ceil(VOICE_LEAD_IN + v + VOICE_TAIL)) : base;
    const timing = {id, from, frames: seconds * FPS, voice: v};
    from += timing.frames;
    return timing;
  });
};

export const totalFrames = (video: Video) =>
  sceneTimings(video).reduce((sum, scene) => sum + scene.frames, 0);

// Music volume at a frame: lower while someone is speaking.
export const musicVolume = (video: Video, frame: number, hasMusicOnly: boolean) => {
  const full = hasMusicOnly ? 0.55 : 0.32;
  const ducked = 0.1;
  for (const scene of sceneTimings(video)) {
    if (!scene.voice) continue;
    const start = scene.from + VOICE_LEAD_IN * FPS;
    const end = start + scene.voice * FPS;
    const ramp = 6;
    if (frame >= start - ramp && frame <= end + ramp * 2) {
      const into = Math.min(1, (frame - (start - ramp)) / ramp, (end + ramp * 2 - frame) / (ramp * 2));
      return full - (full - ducked) * Math.max(0, into);
    }
  }
  return full;
};
