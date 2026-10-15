import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {musicVolume, sceneTimings, Video, VOICE_LEAD_IN} from '../timing';
import {FPS} from '../theme';

// Background music for the whole video, ducked under the voiceover, plus one
// voiceover clip per scene that has one (see scripts/tts.mjs).
export const Soundtrack: React.FC<{video: Video}> = ({video}) => {
  const scenes = sceneTimings(video);
  const hasVoice = scenes.some((scene) => scene.voice);
  return (
    <>
      <Audio
        src={staticFile(`music/${video}.wav`)}
        volume={(frame) => musicVolume(video, frame, !hasVoice)}
      />
      {scenes
        .filter((scene) => scene.voice)
        .map((scene) => (
          <Sequence
            key={scene.id}
            from={scene.from + Math.round(VOICE_LEAD_IN * FPS)}
            durationInFrames={Math.ceil((scene.voice ?? 0) * FPS) + FPS}
            layout="none"
          >
            <Audio src={staticFile(`voiceover/${video}-${scene.id}.wav`)} />
          </Sequence>
        ))}
    </>
  );
};
