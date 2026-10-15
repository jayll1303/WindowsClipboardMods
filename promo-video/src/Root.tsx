import React from 'react';
import {Composition} from 'remotion';
import {Short, SHORT_DURATION} from './Short';
import {FPS} from './theme';
import {YouTube, YOUTUBE_DURATION} from './YouTube';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="YouTube"
      component={YouTube}
      durationInFrames={YOUTUBE_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Short"
      component={Short}
      durationInFrames={SHORT_DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
