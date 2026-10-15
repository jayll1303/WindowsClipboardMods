import React from 'react';
import {Composition} from 'remotion';
import {Short} from './Short';
import {FPS} from './theme';
import {totalFrames} from './timing';
import {YouTube} from './YouTube';

type VideoProps = {themeId: string};

// Pick a theme with --props='{"themeId":"swiss"}'; see themes.tsx for the ids.
const defaultProps: VideoProps = {themeId: 'fluent'};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="YouTube"
      component={YouTube}
      durationInFrames={totalFrames('youtube')}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
    />
    <Composition
      id="Short"
      component={Short}
      durationInFrames={totalFrames('short')}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  </>
);
