import {useCurrentFrame} from 'remotion';

// Scene animations are written against a relaxed timeline; PACE plays them
// faster without rewriting every keyframe. Scene lengths shrink by the same
// factor (see timing.ts), unless the voiceover needs longer.
export const PACE = 1.6;

export const usePacedFrame = () => useCurrentFrame() * PACE;
